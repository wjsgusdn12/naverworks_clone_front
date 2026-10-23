import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

export type ChatRoom = {
  id: number; type: "SELF" | "DIRECT" | "GROUP"; name: string | null; ownerMembershipId: number | null;
  memberCount: number; createdAt: string; lastMessage: string | null; lastMessageAt: string | null; lastSenderMembershipId: number | null; unreadCount: number; oldestUnreadMessageAt: string | null; directMembershipId: number | null; directDisplayName: string | null; directJobGradeName: string | null; directDepartmentName: string | null; directCompanyName: string | null; pinned: boolean; notificationEnabled: boolean;
};

export type ChatMessage = {
  id: number; senderMembershipId: number; senderName: string; content: string; type: "TEXT" | "SYSTEM";
  // unreadCount와 readCount를 분리해 "안 읽었는데 읽음"으로 보이지 않게 처리.
  createdAt: string; unreadCount: number; readCount: number;
};

export type ChatMessagePage = { messages: ChatMessage[]; nextCursor: number | null };
export type ChatReadMember = { membershipId: number; displayName: string; jobGrade: string | null; departmentName: string | null; read: boolean };
export type ChatMemberProfile = { membershipId: number; displayName: string; jobGradeName: string | null; departmentName: string | null; companyName: string };
export type ChatRoomDetail = { room: ChatRoom; memberIds: number[]; members: ChatMemberProfile[] };

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
  // 기존 1:1 방은 재사용하고 없을 때만 서버가 새 방을 생성.
  createDirect: (token: string, targetMembershipId: number) =>
    request<ChatRoom>("/api/v1/chatRoom/direct/create", token, { method: "POST", body: JSON.stringify({ targetMembershipId }) }),
  createSelf: (token: string) => request<ChatRoom>("/api/v1/chatRoom/self/create", token, { method: "POST" }),
  createGroup: (token: string, name: string, membershipIds: number[]) =>
    request<ChatRoom>("/api/v1/chatRoom/group/create", token, { method: "POST", body: JSON.stringify({ name, membershipIds }) }),
  invite: (token: string, roomId: number, membershipId: number) => request<void>(`/api/v1/chatRoom/member/invite?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ membershipId }) }),
  remove: (token: string, roomId: number, membershipId: number) => request<void>(`/api/v1/chatRoom/member/remove?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ membershipId }) }),
  rename: (token: string, roomId: number, name: string) => request<void>(`/api/v1/chatRoom/name/update?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ name }) }),
  transferOwner: (token: string, roomId: number, membershipId: number) => request<void>(`/api/v1/chatRoom/owner/update?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ membershipId }) }),
  leave: (token: string, roomId: number) => request<void>(`/api/v1/chatRoom/leave?chatRoomId=${roomId}`, token, { method: "POST" }),
  hide: (token: string, roomId: number) => request<void>(`/api/v1/chatRoom/hide?chatRoomId=${roomId}`, token, { method: "POST" }),
  togglePin: (token: string, roomId: number) => request<void>(`/api/v1/chatRoom/pin/update?chatRoomId=${roomId}`, token, { method: "POST" }),
  updateNotification: (token: string, roomId: number, enabled: boolean) => request<void>(`/api/v1/chatRoom/notification/update?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ enabled }) }),
  detail: (token: string, roomId: number) => request<ChatRoomDetail>(`/api/v1/chatRoom/detail?chatRoomId=${roomId}`, token),
  messages: (token: string, roomId: number, cursor?: number) => request<ChatMessagePage>(`/api/v1/chatRoom/message?chatRoomId=${roomId}${cursor ? `&cursor=${cursor}` : ""}`, token),
  send: (token: string, roomId: number, content: string) => request<ChatMessage>(`/api/v1/chatRoom/message/create?chatRoomId=${roomId}`, token, { method: "POST", body: JSON.stringify({ content }) }),
  readMembers: (token: string, roomId: number, messageId: number, read: boolean) => request<ChatReadMember[]>(`/api/v1/chatRoom/message/readMember?chatRoomId=${roomId}&messageId=${messageId}&read=${read}`, token),
};
