import { Client } from "@stomp/stompjs";
import type { ChatMessage } from "@/lib/api/chat-api";

type ChatRealtimeEvent = {
  type: "MESSAGE_CREATED";
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
  onTypingChanged: (event: ChatTypingEvent) => void;
  onGlobalTypingChanged: (event: ChatTypingEvent) => void;
  onConnected?: (sendTyping: (typing: boolean) => void) => void;
  onError: (message: string) => void;
};

// 현재 열린 방만 구독해 불필요한 WebSocket 이벤트와 렌더링을 줄임.
export const connectChatRoom = ({
  accessToken,
  chatRoomId,
  subscribedChatRoomIds,
  onMessageCreated,
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
    debug: () => undefined,
    onConnect: () => {
      // 참여 중인 모든 방을 구독해, 다른 방의 입력 상태도 목록에서 즉시 표시.
      [...new Set(subscribedChatRoomIds)].forEach((subscribedRoomId) => {
        client.subscribe(`/topic/chatRoom/${subscribedRoomId}`, (frame) => {
          try {
            const event = JSON.parse(frame.body) as ChatRealtimeEvent | ChatTypingEvent;
            if (event.type === "MESSAGE_CREATED" && event.chatRoomId === chatRoomId) {
              onMessageCreated(event);
            }
            if (event.type === "TYPING_CHANGED") {
              // 목록 미리보기와 현재 방의 입력 말풍선을 동시에 동기화.
              onGlobalTypingChanged(event);
              if (event.chatRoomId === chatRoomId) onTypingChanged(event);
            }
          } catch {
            onError("실시간 메시지 데이터를 해석하지 못했습니다.");
          }
        });
      });
      onConnected?.(publishTyping);
    },
    onStompError: (frame) => onError(frame.headers.message ?? "실시간 메시지 연결이 거부되었습니다."),
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
