import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

export type ChatRoom = {
  id: number; type: "DIRECT" | "GROUP"; name: string | null; ownerMembershipId: number | null;
  memberCount: number; createdAt: string; lastMessage: string | null; lastMessageAt: string | null; unreadCount: number;
};

export type ChatMessage = {
  id: number; senderMembershipId: number; senderName: string; content: string; type: "TEXT" | "SYSTEM";
  createdAt: string; unreadCount: number;
};

export type ChatMessagePage = { messages: ChatMessage[]; nextCursor: number | null };
export type ChatReadMember = { membershipId: number; displayName: string; jobGrade: string | null; departmentName: string | null; read: boolean };

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  return value.replace(/\/$/, "");
};

const request = async <T>(path: string, accessToken: string, init: RequestInit = {}) => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...init.headers } });
  } catch {
    throw new ApiClientError("메시지 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.", 0, "NETWORK_ERROR");
  }
  const body = await response.json().catch(() => ({})) as Partial<ApiResponse<T>>;
  if (!response.ok || !body.success || body.data === undefined) throw new ApiClientError(body.message ?? "메시지 요청을 처리하지 못했습니다.", response.status, body.code ?? "UNKNOWN_ERROR");
  return body.data;
};

export const chatApi = {
  rooms: (token: string) => request<ChatRoom[]>("/api/v1/chatRoom", token),
  detail: (token: string, roomId: number) => request<{ room: ChatRoom; memberIds: number[] }>(`/api/v1/chatRoom/detail?chatRoomId=${roomId}`, token),
  messages: (token: string, roomId: number, cursor?: number) => request<ChatMessagePage>(`/api/v1/chatRoom/message?chatRoomId=${roomId}${cursor ? `&cursor=${cursor}` : ""}`, token),
  send: (token: string, roomId: number, content: string) => request<ChatMessage>(`/api/v1/chatRoom/message/create?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ content }) }),
  readMembers: (token: string, roomId: number, messageId: number, read: boolean) => request<ChatReadMember[]>(`/api/v1/chatRoom/message/readMember?chatRoomId=${roomId}&messageId=${messageId}&read=${read}`, token),
};
