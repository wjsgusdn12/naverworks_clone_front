import type { ChatMessage, ChatRoom } from "@/lib/api/chat-api";

export const DELETED_MESSAGE_CONTENT = "삭제된 메시지입니다.";

// REST 응답과 STOMP 이벤트의 도착 순서가 바뀌어도 오래된 버전으로 되돌리지 않음.
export function applyMessageChange(current: ChatMessage, incoming: ChatMessage): ChatMessage {
  if (current.id === incoming.id) {
    if ((current.version ?? 0) > (incoming.version ?? 0)) return current;
    return incoming.deletedAt ? incoming : {
      ...incoming,
      readCount: Math.max(current.readCount, incoming.readCount),
      unreadCount: Math.min(current.unreadCount, incoming.unreadCount),
    };
  }
  // 원문이 삭제되면 이미 받은 답장 인용에서도 원문 내용 제거.
  if (incoming.deletedAt && current.reply?.messageId === incoming.id) {
    return { ...current, reply: { ...current.reply, content: DELETED_MESSAGE_CONTENT, deleted: true } };
  }
  return current;
}

export function applyRoomMessageChange(room: ChatRoom, incoming: ChatMessage, membershipId: number): ChatRoom {
  if (room.lastMessageId !== incoming.id || (room.lastMessageVersion ?? 0) > (incoming.version ?? 0)) return room;
  // 수정·삭제는 새 메시지가 아니므로 정렬 시각과 안 읽음 수를 여기서 증가시키지 않음.
  return {
    ...room,
    lastMessage: incoming.content,
    lastMessageVersion: incoming.version,
    lastMessageMentioned: !incoming.deletedAt && incoming.mentionedMembershipIds.includes(membershipId),
  };
}
