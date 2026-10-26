import { Client } from "@stomp/stompjs";
import type { ChatMessage } from "@/lib/api/chat-api";

type ChatRealtimeEvent = {
  type: "MESSAGE_CREATED";
  chatRoomId: number;
  message: ChatMessage;
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
  onMessageCreated: (event: ChatRealtimeEvent) => void;
  onError: (message: string) => void;
};

// 현재 열린 방만 구독해 불필요한 WebSocket 이벤트와 렌더링을 줄임.
export const connectChatRoom = ({
  accessToken,
  chatRoomId,
  onMessageCreated,
  onError,
}: ConnectChatRoomOptions) => {
  const client = new Client({
    brokerURL: websocketUrl(),
    connectHeaders: { Authorization: `Bearer ${accessToken}` },
    reconnectDelay: 3_000,
    debug: () => undefined,
    onConnect: () => {
      client.subscribe(`/topic/chatRoom/${chatRoomId}`, (frame) => {
        try {
          const event = JSON.parse(frame.body) as ChatRealtimeEvent;
          if (event.type === "MESSAGE_CREATED" && event.chatRoomId === chatRoomId) {
            onMessageCreated(event);
          }
        } catch {
          onError("실시간 메시지 데이터를 해석하지 못했습니다.");
        }
      });
    },
    onStompError: (frame) => onError(frame.headers.message ?? "실시간 메시지 연결이 거부되었습니다."),
    onWebSocketError: () => onError("실시간 메시지 서버 연결에 실패했습니다."),
  });
  client.activate();

  return () => {
    void client.deactivate();
  };
};
