import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

export type ChatRoom = {
  id: number;
  type: "SELF" | "DIRECT" | "GROUP";
  name: string | null;
  ownerMembershipId: number | null;
  memberCount: number;
  createdAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderMembershipId: number | null;
  unreadCount: number;
  oldestUnreadMessageAt: string | null;
  directMembershipId: number | null;
  directDisplayName: string | null;
  directJobGradeName: string | null;
  directDepartmentName: string | null;
  directCompanyName: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  notificationEnabled: boolean;
  notificationMode: "ALL" | "MENTION" | "NONE";
  lastMessageMentioned: boolean;
  lastMessageId: number | null;
  lastMessageVersion: number;
};

export type ChatMessage = {
  id: number;
  senderMembershipId: number;
  senderName: string;
  content: string;
  type: "TEXT" | "SYSTEM";
  // unreadCount와 readCount를 분리해 "안 읽었는데 읽음"으로 보이지 않게 처리.
  createdAt: string;
  unreadCount: number;
  readCount: number;
  mentionedMembershipIds: number[];
  reply: ChatReply | null;
  editedAt: string | null;
  deletedAt: string | null;
  version: number;
  // 이모지별 집계. reactedByMe는 로그인한 사용자 기준.
  reactions: ChatReaction[];
  // 다른 방에서 전달해 온 메시지면 true("전달된 메시지" 라벨 표시).
  forwarded: boolean;
};

// 방 상단에 고정하는 공지. 방당 하나.
export type ChatNotice = {
  messageId: number;
  senderName: string;
  content: string;
  setByMembershipId: number | null;
  setByName: string | null;
  setAt: string;
};

// 서버에는 코드명(thumbs_up 등)으로 저장하고, 화면에서 문자로 바꿔 보여 줌.
export type ChatReaction = { emoji: string; count: number; reactedByMe: boolean };
// 리액션 사용자 모달 한 줄: 누른 사람과 그 사람이 고른 이모지(1인 1개).
export type ChatReactionMember = { emoji: string; member: ChatMemberProfile };

// 원문 위치와 답장 당시 인용 정보를 함께 전달.
export type ChatReply = {
  messageId: number;
  senderName: string;
  content: string;
  deleted?: boolean;
};
export type ChatMessagePage = {
  messages: ChatMessage[];
  nextCursor: number | null;
  newerCursor: number | null;
};
export type ChatReadMember = {
  membershipId: number;
  displayName: string;
  jobGrade: string | null;
  departmentName: string | null;
  companyName: string | null;
  read: boolean;
};
export type ChatMemberProfile = {
  membershipId: number;
  displayName: string;
  jobGradeName: string | null;
  departmentName: string | null;
  companyName: string;
};
// 구성원별 마지막 읽은 메시지 ID. 말풍선 읽음 수는 이 값으로 계산.
export type ChatReadCursor = { membershipId: number; lastReadMessageId: number | null };
export type ChatRoomDetail = {
  room: ChatRoom;
  memberIds: number[];
  members: ChatMemberProfile[];
  readCursors: ChatReadCursor[];
  notice: ChatNotice | null;
};

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  return value.replace(/\/$/, "");
};

const request = async <T>(path: string, accessToken: string, init: RequestInit = {}) => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      "메시지 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
      0,
      "NETWORK_ERROR",
    );
  }
  const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;
  if (!response.ok || !body.success || body.data === undefined)
    throw new ApiClientError(
      body.message ?? "메시지 요청을 처리하지 못했습니다.",
      response.status,
      body.code ?? "UNKNOWN_ERROR",
    );
  return body.data;
};

export const chatApi = {
  rooms: (token: string) => request<ChatRoom[]>("/api/v1/chatRoom", token),
  // 기존 1:1 방은 재사용하고 없을 때만 서버가 새 방을 생성.
  createDirect: (token: string, targetMembershipId: number) =>
    request<ChatRoom>("/api/v1/chatRoom/direct/create", token, {
      method: "POST",
      body: JSON.stringify({ targetMembershipId }),
    }),
  createSelf: (token: string) =>
    request<ChatRoom>("/api/v1/chatRoom/self/create", token, { method: "POST" }),
  createGroup: (token: string, name: string, membershipIds: number[]) =>
    request<ChatRoom>("/api/v1/chatRoom/group/create", token, {
      method: "POST",
      body: JSON.stringify({ name, membershipIds }),
    }),
  invite: (token: string, roomId: number, membershipId: number) =>
    request<void>(`/api/v1/chatRoom/member/invite?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ membershipId }),
    }),
  remove: (token: string, roomId: number, membershipId: number) =>
    request<void>(`/api/v1/chatRoom/member/remove?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ membershipId }),
    }),
  rename: (token: string, roomId: number, name: string) =>
    request<void>(`/api/v1/chatRoom/name/update?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  transferOwner: (token: string, roomId: number, membershipId: number) =>
    request<void>(`/api/v1/chatRoom/owner/update?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ membershipId }),
    }),
  leave: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/leave?chatRoomId=${roomId}`, token, { method: "POST" }),
  hide: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/hide?chatRoomId=${roomId}`, token, { method: "POST" }),
  togglePin: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/pin/update?chatRoomId=${roomId}`, token, { method: "POST" }),
  updateNotification: (token: string, roomId: number, mode: "ALL" | "MENTION" | "NONE") =>
    request<void>(`/api/v1/chatRoom/notification/update?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  detail: (token: string, roomId: number) =>
    request<ChatRoomDetail>(`/api/v1/chatRoom/detail?chatRoomId=${roomId}`, token),
  messages: (token: string, roomId: number, cursor?: number) =>
    request<ChatMessagePage>(
      `/api/v1/chatRoom/message?chatRoomId=${roomId}${cursor ? `&cursor=${cursor}` : ""}`,
      token,
    ),
  // 원문 이동은 해당 위치만 조회하고, 이후 페이지는 다음 커서로 연결.
  messageAnchor: (token: string, roomId: number, messageId: number) =>
    request<ChatMessagePage>(
      `/api/v1/chatRoom/message?chatRoomId=${roomId}&anchorMessageId=${messageId}`,
      token,
    ),
  newerMessages: (token: string, roomId: number, cursor: number) =>
    request<ChatMessagePage>(
      `/api/v1/chatRoom/message?chatRoomId=${roomId}&afterCursor=${cursor}`,
      token,
    ),
  send: (
    token: string,
    roomId: number,
    content: string,
    mentionedMembershipIds: number[] = [],
    replyToMessageId?: number,
  ) =>
    request<ChatMessage>(`/api/v1/chatRoom/message/create?chatRoomId=${roomId}`, token, {
      method: "POST",
      body: JSON.stringify({ content, mentionedMembershipIds, replyToMessageId }),
    }),
  updateMessage: (
    token: string,
    roomId: number,
    messageId: number,
    content: string,
    mentionedMembershipIds: number[],
    expectedVersion: number,
  ) =>
    request<ChatMessage>(
      `/api/v1/chatRoom/message/update/${messageId}?chatRoomId=${roomId}`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ content, mentionedMembershipIds, expectedVersion }),
      },
    ),
  deleteMessage: (token: string, roomId: number, messageId: number, expectedVersion: number) =>
    request<ChatMessage>(
      `/api/v1/chatRoom/message/delete/${messageId}?chatRoomId=${roomId}`,
      token,
      { method: "POST", body: JSON.stringify({ expectedVersion }) },
    ),
  // 현재 보고 있는 방에 도착한 메시지는 즉시 읽음 위치를 서버에도 반영.
  markRead: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/read/update?chatRoomId=${roomId}`, token, { method: "POST" }),
  // 추가·취소를 따로 두어 재시도해도 결과가 뒤집히지 않게 함(토글 아님).
  addReaction: (token: string, roomId: number, messageId: number, emoji: string) =>
    request<ChatReaction[]>(
      `/api/v1/chatRoom/message/reaction/add?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST", body: JSON.stringify({ emoji }) },
    ),
  removeReaction: (token: string, roomId: number, messageId: number, emoji: string) =>
    request<ChatReaction[]>(
      `/api/v1/chatRoom/message/reaction/remove?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST", body: JSON.stringify({ emoji }) },
    ),
  // 메시지 전달. 선택한 방마다 새 메시지로 복사(최대 10개).
  forwardMessage: (token: string, roomId: number, messageId: number, targetChatRoomIds: number[]) =>
    request<ChatMessage[]>(
      `/api/v1/chatRoom/message/forward?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST", body: JSON.stringify({ targetChatRoomIds }) },
    ),
  // 공지 등록(기존 공지 교체)과 해제.
  updateNotice: (token: string, roomId: number, messageId: number) =>
    request<ChatNotice>(
      `/api/v1/chatRoom/notice/update?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST" },
    ),
  removeNotice: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/notice/remove?chatRoomId=${roomId}`, token, {
      method: "POST",
    }),
  // 메시지에 리액션한 사람 전체(이모지 구분 없음, 누른 순서).
  reactionMembers: (token: string, roomId: number, messageId: number) =>
    request<ChatReactionMember[]>(
      `/api/v1/chatRoom/message/reaction/member?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
    ),
  readMembers: (token: string, roomId: number, messageId: number, read: boolean) =>
    request<ChatReadMember[]>(
      `/api/v1/chatRoom/message/readMember?chatRoomId=${roomId}&messageId=${messageId}&read=${read}`,
      token,
    ),
};
