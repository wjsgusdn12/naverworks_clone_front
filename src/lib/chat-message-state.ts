import type { ChatMessage, ChatReaction, ChatRoom } from "@/lib/api/chat-api";

export const DELETED_MESSAGE_CONTENT = "삭제된 메시지입니다.";

// REST 응답과 STOMP 이벤트의 도착 순서가 바뀌어도 오래된 버전으로 되돌리지 않음.
export function applyMessageChange(current: ChatMessage, incoming: ChatMessage): ChatMessage {
  if (current.id === incoming.id) {
    if ((current.version ?? 0) > (incoming.version ?? 0)) return current;
    return incoming.deletedAt
      ? incoming
      : {
          ...incoming,
          readCount: Math.max(current.readCount, incoming.readCount),
          unreadCount: Math.min(current.unreadCount, incoming.unreadCount),
          // 수정·삭제 이벤트는 모든 참여자에게 같은 내용으로 가므로 reactedByMe는 내 화면의 값을 유지.
          reactions: current.reactions ?? incoming.reactions ?? [],
        };
  }
  // 원문이 삭제되면 이미 받은 답장 인용에서도 원문 내용 제거.
  if (incoming.deletedAt && current.reply?.messageId === incoming.id) {
    return {
      ...current,
      reply: { ...current.reply, content: DELETED_MESSAGE_CONTENT, deleted: true },
    };
  }
  return current;
}

// 리액션 변화분(누가 어떤 이모지를 추가/취소)을 내 화면의 집계에 반영.
// 같은 변화를 두 번 받아도(내 요청 응답 + 실시간 이벤트) 수가 어긋나지 않도록 reactedByMe로 중복을 걸러냄.
export function applyReactionChange(
  reactions: ChatReaction[],
  change: { emoji: string; membershipId: number; action: "added" | "removed" },
  myMembershipId: number,
): ChatReaction[] {
  const isMine = change.membershipId === myMembershipId;
  const existing = reactions.find((reaction) => reaction.emoji === change.emoji);
  if (change.action === "added") {
    if (!existing) return [...reactions, { emoji: change.emoji, count: 1, reactedByMe: isMine }];
    // 내가 이미 누른 것으로 표시된 이모지에 내 추가 이벤트가 또 오면 이미 반영된 것.
    if (isMine && existing.reactedByMe) return reactions;
    return reactions.map((reaction) =>
      reaction.emoji === change.emoji
        ? { ...reaction, count: reaction.count + 1, reactedByMe: reaction.reactedByMe || isMine }
        : reaction,
    );
  }
  if (!existing) return reactions;
  if (isMine && !existing.reactedByMe) return reactions;
  const count = existing.count - 1;
  // 마지막 사람이 취소하면 묶음 자체를 없앰.
  if (count <= 0) return reactions.filter((reaction) => reaction.emoji !== change.emoji);
  return reactions.map((reaction) =>
    reaction.emoji === change.emoji
      ? { ...reaction, count, reactedByMe: isMine ? false : reaction.reactedByMe }
      : reaction,
  );
}

// 방의 읽음 상태. 구성원별 읽은 위치(lastReadMessageId)와 현재 활성 구성원 목록.
export type ReadState = {
  cursors: Record<number, number | null>;
  memberIds: number[];
};

// 말풍선 읽음 수를 "이벤트마다 +1"이 아니라 구성원별 읽은 위치에서 매번 다시 계산.
// 같은 사람의 읽음 이벤트가 여러 번 와도, 메시지가 이벤트보다 늦게 붙어도 결과가 같음.
// 서버가 이미 더 높은 수를 내려준 경우(이벤트를 놓친 상황)에는 낮추지 않음.
export function applyReadCursors(messages: ChatMessage[], state: ReadState): ChatMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    if (message.type !== "TEXT" || message.deletedAt) return message;
    const recipients = state.memberIds.filter((id) => id !== message.senderMembershipId);
    const readByCursor = recipients.filter((id) => (state.cursors[id] ?? 0) >= message.id).length;
    const readCount = Math.max(readByCursor, message.readCount);
    const unreadCount = Math.max(0, recipients.length - readCount);
    if (readCount === message.readCount && unreadCount === message.unreadCount) return message;
    changed = true;
    return { ...message, readCount, unreadCount };
  });
  return changed ? next : messages;
}

export function applyRoomMessageChange(
  room: ChatRoom,
  incoming: ChatMessage,
  membershipId: number,
): ChatRoom {
  if (
    room.lastMessageId !== incoming.id ||
    (room.lastMessageVersion ?? 0) > (incoming.version ?? 0)
  )
    return room;
  // 수정·삭제는 새 메시지가 아니므로 정렬 시각과 안 읽음 수를 여기서 증가시키지 않음.
  return {
    ...room,
    lastMessage: incoming.content,
    lastMessageVersion: incoming.version,
    lastMessageMentioned:
      !incoming.deletedAt && incoming.mentionedMembershipIds.includes(membershipId),
  };
}
