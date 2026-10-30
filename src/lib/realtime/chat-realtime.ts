import { Client } from "@stomp/stompjs";
import type { ChatMessage, ChatNotice } from "@/lib/api/chat-api";
import type { NotificationItem } from "@/lib/api/notification-api";
import type { MemberStatusType } from "@/lib/status-options";

// 서버가 내 전용 큐(/user/queue/notification)로 보내는 새 서비스 알림.
export type NotificationRealtimeEvent = {
  type: "NOTIFICATION_CREATED";
  notification: NotificationItem;
};

type ChatRealtimeEvent = {
  type: "MESSAGE_CREATED";
  chatRoomId: number;
  message: ChatMessage;
};

export type ChatMessageChangeEvent = {
  type: "MESSAGE_UPDATED" | "MESSAGE_DELETED";
  chatRoomId: number;
  message: ChatMessage;
};

type ChatTypingEvent = {
  type: "TYPING_CHANGED";
  chatRoomId: number;
  membershipId: number;
  displayName: string;
  typing: boolean;
};

// 리액션 변화분. 전체 집계가 아니라 "누가 어떤 이모지를 추가/취소했는지"만 받아 클라이언트가 반영.
export type ChatReactionEvent = {
  type: "REACTION_UPDATED";
  chatRoomId: number;
  messageId: number;
  emoji: string;
  membershipId: number;
  action: "added" | "removed";
};

// 공지 등록·내리기 뒤의 공지 목록 전체. 빈 배열이면 공지 없음.
export type ChatNoticeEvent = {
  type: "NOTICE_UPDATED";
  chatRoomId: number;
  notices: ChatNotice[];
};

type ChatReadEvent = {
  type: "READ_UPDATED";
  chatRoomId: number;
  readerMembershipId: number;
  lastReadMessageId: number;
};

export type PresenceRealtimeEvent = {
  type: "PRESENCE_CHANGED";
  membershipId: number;
  online: boolean;
  // 화면 표시용 접속 상태.
  status: "ONLINE" | "OFFLINE";
  // 구성원이 고른 상태 설정(바쁨·휴가 등). 없으면 null.
  statusType: MemberStatusType | null;
  statusUntil: string | null;
};

const websocketUrl = () => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
};

type ConnectChatRoomOptions = {
  accessToken: string;
  chatRoomId: number;
  subscribedChatRoomIds: number[];
  onMessageCreated: (event: ChatRealtimeEvent) => void;
  onRoomMessageCreated: (event: ChatRealtimeEvent) => void;
  onMessageChanged: (event: ChatMessageChangeEvent) => void;
  onReactionChanged: (event: ChatReactionEvent) => void;
  onNoticeChanged: (event: ChatNoticeEvent) => void;
  onReadUpdated: (event: ChatReadEvent) => void;
  onTypingChanged: (event: ChatTypingEvent) => void;
  onGlobalTypingChanged: (event: ChatTypingEvent) => void;
  onConnected?: (sendTyping: (typing: boolean) => void) => void;
  onError: (message: string) => void;
};

type ConnectChatNotificationOptions = {
  accessToken: string;
  subscribedChatRoomIds: number[];
  onMessageCreated: (event: ChatRealtimeEvent) => void;
  onMessageChanged: (event: ChatMessageChangeEvent) => void;
  onPresenceChanged?: (event: PresenceRealtimeEvent) => void;
  onNotificationCreated?: (event: NotificationRealtimeEvent) => void;
  onError: (message: string) => void;
};

// 현재 열린 방만 구독해 불필요한 WebSocket 이벤트와 렌더링을 줄임.
export const connectChatRoom = ({
  accessToken,
  chatRoomId,
  subscribedChatRoomIds,
  onMessageCreated,
  onRoomMessageCreated,
  onMessageChanged,
  onReactionChanged,
  onNoticeChanged,
  onReadUpdated,
  onTypingChanged,
  onGlobalTypingChanged,
  onConnected,
  onError,
}: ConnectChatRoomOptions) => {
  const publishTyping = (typing: boolean) => {
    if (!client.connected) return;
    client.publish({
      destination: `/app/chatRoom/${chatRoomId}/typing`,
      body: JSON.stringify({ typing }),
    });
  };
  const client = new Client({
    brokerURL: websocketUrl(),
    connectHeaders: { Authorization: `Bearer ${accessToken}` },
    reconnectDelay: 3_000,
    // 서버와 10초마다 "살아 있음" 신호를 주고받아, 끊긴 연결을 서버가 빨리 알아채게 함(접속 상태 정확도).
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
    debug: () => undefined,
    onConnect: () => {
      // 참여 중인 모든 방을 구독해, 다른 방의 입력 상태도 목록에서 즉시 표시.
      [...new Set(subscribedChatRoomIds)].forEach((subscribedRoomId) => {
        client.subscribe(`/topic/chatRoom/${subscribedRoomId}`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as
              | ChatRealtimeEvent
              | ChatTypingEvent
              | ChatReadEvent
              | ChatMessageChangeEvent
              | ChatReactionEvent
              | ChatNoticeEvent;
            if (event.type === "MESSAGE_CREATED") {
              // 방 목록은 모든 참여 방의 최신 메시지를 받아 즉시 갱신.
              onRoomMessageCreated(event);
              if (event.chatRoomId === chatRoomId) onMessageCreated(event);
            }
            if (event.type === "TYPING_CHANGED") {
              // 목록 미리보기와 현재 방의 입력 말풍선을 동시에 동기화.
              onGlobalTypingChanged(event);
              if (event.chatRoomId === chatRoomId) onTypingChanged(event);
            }
            if (event.type === "READ_UPDATED") onReadUpdated(event);
            if (event.type === "MESSAGE_UPDATED" || event.type === "MESSAGE_DELETED")
              onMessageChanged(event);
            if (event.type === "REACTION_UPDATED" && event.chatRoomId === chatRoomId)
              onReactionChanged(event);
            if (event.type === "NOTICE_UPDATED" && event.chatRoomId === chatRoomId)
              onNoticeChanged(event);
          } catch {
            onError("실시간 메시지 데이터를 해석하지 못했습니다.");
          }
        });
      });
      onConnected?.(publishTyping);
    },
    onStompError: (frame) =>
      onError(frame.headers.message ?? "실시간 메시지 연결이 거부되었습니다."),
    onWebSocketError: () => onError("실시간 메시지 서버 연결에 실패했습니다."),
  });
  client.activate();

  return {
    // 연결 완료 전에는 발행하지 않아 방 이동 중 이전 방에 이벤트가 남지 않게 함.
    sendTyping: publishTyping,
    disconnect: () => {
      void client.deactivate();
    },
  };
};

// 메시지 화면 밖에서도 새 메시지 알림을 받기 위한 읽기 전용 구독.
export const connectChatNotification = ({
  accessToken,
  subscribedChatRoomIds,
  onMessageCreated,
  onPresenceChanged,
  onMessageChanged,
  onNotificationCreated,
  onError,
}: ConnectChatNotificationOptions) => {
  const client = new Client({
    brokerURL: websocketUrl(),
    connectHeaders: { Authorization: `Bearer ${accessToken}` },
    reconnectDelay: 3_000,
    // 서버와 10초마다 "살아 있음" 신호를 주고받아, 끊긴 연결을 서버가 빨리 알아채게 함(접속 상태 정확도).
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
    debug: () => undefined,
    onConnect: () => {
      client.subscribe("/topic/presence", (frame) => {
        try {
          const event = JSON.parse(frame.body) as PresenceRealtimeEvent;
          if (event.type === "PRESENCE_CHANGED") onPresenceChanged?.(event);
        } catch {
          onError("실시간 상태 데이터를 해석하지 못했습니다.");
        }
      });
      // 서비스 알림은 방과 무관하게 로그인한 사용자 전용 큐로 받음.
      client.subscribe("/user/queue/notification", (frame) => {
        try {
          const event = JSON.parse(frame.body) as NotificationRealtimeEvent;
          if (event.type === "NOTIFICATION_CREATED") onNotificationCreated?.(event);
        } catch {
          onError("실시간 알림 데이터를 해석하지 못했습니다.");
        }
      });
      [...new Set(subscribedChatRoomIds)].forEach((chatRoomId) => {
        client.subscribe(`/topic/chatRoom/${chatRoomId}`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as ChatRealtimeEvent | ChatMessageChangeEvent;
            if (event.type === "MESSAGE_CREATED") onMessageCreated(event);
            if (event.type === "MESSAGE_UPDATED" || event.type === "MESSAGE_DELETED")
              onMessageChanged(event);
          } catch {
            onError("실시간 메시지 알림 데이터를 해석하지 못했습니다.");
          }
        });
      });
    },
    onStompError: (frame) =>
      onError(frame.headers.message ?? "실시간 메시지 알림 연결이 거부되었습니다."),
    onWebSocketError: () => onError("실시간 메시지 알림 서버 연결에 실패했습니다."),
  });
  client.activate();

  return {
    disconnect: () => {
      void client.deactivate();
    },
  };
};
