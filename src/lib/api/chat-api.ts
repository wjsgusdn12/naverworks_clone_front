import { ApiClientError } from "@/lib/api/auth-api";
import type { MemberStatus, PresenceStatus } from "@/lib/api/address-book-api";

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
  // 사진·파일 메시지의 첨부. 일반 메시지·삭제된 메시지는 null.
  attachment: ChatAttachment | null;
};

// 첨부 정보. IMAGE는 말풍선에 바로 보여 주고, FILE은 내려받기 카드로 보여 줌.
// width·height는 사진을 받기 전에 자리를 잡는 용도(알 수 없으면 null).
export type ChatAttachment = {
  id: number;
  kind: "IMAGE" | "FILE";
  name: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
};
// 방 상세의 사진·파일 모아보기 한 줄.
export type ChatAttachmentItem = {
  attachment: ChatAttachment;
  messageId: number;
  senderMembershipId: number;
  senderName: string;
  createdAt: string;
};
export type ChatAttachmentPage = { items: ChatAttachmentItem[]; nextCursor: number | null };

// 상단 검색 결과가 속한 방. name은 화면에 보일 이름, hidden은 내가 목록에서 숨긴 방인지,
// directMembershipId는 1:1 방 상대(아바타 접속 상태용).
export type ChatSearchRoom = {
  id: number;
  type: "SELF" | "DIRECT" | "GROUP";
  name: string;
  hidden: boolean;
  memberCount: number;
  directMembershipId: number | null;
};
// 상단 검색 왼쪽 방 목록 한 줄: 방과 그 방에서 키워드에 맞는 메시지(또는 파일) 수.
export type ChatSearchRoomItem = { room: ChatSearchRoom; count: number };
// 상단 검색 [메시지] 오른쪽 한 줄. forwarded는 전달받은 메시지인지.
export type ChatMessageSearchItem = {
  messageId: number;
  room: ChatSearchRoom;
  senderMembershipId: number;
  senderName: string;
  content: string;
  forwarded: boolean;
  createdAt: string;
};
// 상단 검색 [파일] 한 줄.
export type ChatFileSearchItem = {
  attachment: ChatAttachment;
  messageId: number;
  room: ChatSearchRoom;
  senderName: string;
  createdAt: string;
};
export type ChatSearchPage<T> = { items: T[]; nextCursor: number | null };

// 주소록 "그룹" 탭의 그룹 채팅방 요약. joined는 내가 참여 중, owner는 내가 방장.
export type ChatGroupSummary = {
  id: number;
  name: string | null;
  ownerMembershipId: number | null;
  ownerName: string | null;
  memberCount: number;
  joined: boolean;
  owner: boolean;
  createdAt: string;
  lastMessageAt: string | null;
};

// 주소록 그룹 상세 패널의 구성원 한 줄. favorite은 내 즐겨찾기 여부, owner는 방장 여부.
export type ChatGroupMember = {
  membershipId: number;
  displayName: string;
  jobTitle: string | null;
  jobGradeName: string | null;
  departmentName: string | null;
  companyName: string;
  favorite: boolean;
  owner: boolean;
  presenceStatus: PresenceStatus;
} & MemberStatus;

// 방 상단에 고정하는 공지. 방당 여러 개, 최근 등록이 앞.
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
  notices: ChatNotice[];
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

// 첨부 업로드. fetch는 업로드 진행률을 알려 주지 않아 XMLHttpRequest로 보냄(브라우저 기본 기능).
const uploadAttachment = (
  token: string,
  roomId: number,
  file: File,
  replyToMessageId: number | undefined,
  onProgress: (percent: number) => void,
) =>
  new Promise<ChatMessage>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const query = `chatRoomId=${roomId}${replyToMessageId ? `&replyToMessageId=${replyToMessageId}` : ""}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl()}/api/v1/chatRoom/message/attachment/create?${query}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: Partial<ApiResponse<ChatMessage>> = {};
      try {
        body = JSON.parse(xhr.responseText) as Partial<ApiResponse<ChatMessage>>;
      } catch {
        // 본문이 JSON이 아니면 아래 공통 오류로 처리.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.success && body.data) resolve(body.data);
      else
        reject(
          new ApiClientError(
            body.message ?? "파일을 보내지 못했습니다.",
            xhr.status,
            body.code ?? "UNKNOWN_ERROR",
          ),
        );
    };
    xhr.onerror = () =>
      reject(
        new ApiClientError(
          "메시지 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
          0,
          "NETWORK_ERROR",
        ),
      );
    xhr.send(form);
  });

// 첨부 내용을 받아 옴. 토큰을 헤더로 보내야 해서 <img src>에 주소를 바로 넣지 않고 Blob으로 받음.
// inline=true면 사진을 화면 표시용 형식으로 받음.
const attachmentBlob = async (token: string, attachmentId: number, inline: boolean) => {
  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl()}/api/v1/chatRoom/message/attachment/download?attachmentId=${attachmentId}&inline=${inline}`,
      { credentials: "include", headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    throw new ApiClientError("메시지 서버에 연결할 수 없습니다.", 0, "NETWORK_ERROR");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<unknown>>;
    throw new ApiClientError(
      body.message ?? "파일을 불러오지 못했습니다.",
      response.status,
      body.code ?? "UNKNOWN_ERROR",
    );
  }
  return response.blob();
};

export const chatApi = {
  uploadAttachment,
  attachmentBlob,
  // 사진·파일 모아보기(최신순). cursor는 이전 페이지의 nextCursor.
  attachments: (token: string, roomId: number, kind: ChatAttachment["kind"], cursor?: number) =>
    request<ChatAttachmentPage>(
      `/api/v1/chatRoom/message/attachment/list?chatRoomId=${roomId}&kind=${kind}${cursor ? `&cursor=${cursor}` : ""}`,
      token,
    ),
  rooms: (token: string) => request<ChatRoom[]>("/api/v1/chatRoom", token),
  // 주소록 "그룹" 탭: 내 회사의 그룹 채팅방 전체(참여 여부 무관).
  groupRooms: (token: string) => request<ChatGroupSummary[]>("/api/v1/chatRoom/group/list", token),
  groupMembers: (token: string, roomId: number) =>
    request<ChatGroupMember[]>(`/api/v1/chatRoom/group/members?chatRoomId=${roomId}`, token),
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
  // 숨긴 방을 목록에 다시 보이게 함(검색 결과에서 숨긴 방을 열 때).
  unhide: (token: string, roomId: number) =>
    request<void>(`/api/v1/chatRoom/unhide?chatRoomId=${roomId}`, token, { method: "POST" }),
  // 상단 검색 [메시지]: 왼쪽은 키워드가 들어간 메시지가 있는 방과 방별 개수, 오른쪽은 고른 방의 메시지.
  // 30개씩, cursor는 이전 nextCursor.
  searchMessageRooms: (token: string, keyword: string) =>
    request<ChatSearchRoomItem[]>(
      `/api/v1/chatRoom/search/message/room?keyword=${encodeURIComponent(keyword)}`,
      token,
    ),
  searchMessages: (token: string, keyword: string, roomId: number, cursor?: number) =>
    request<ChatSearchPage<ChatMessageSearchItem>>(
      `/api/v1/chatRoom/search/message?keyword=${encodeURIComponent(keyword)}&chatRoomId=${roomId}${cursor ? `&cursor=${cursor}` : ""}`,
      token,
    ),
  // 상단 검색 [파일]: 왼쪽은 파일 이름에 키워드가 들어간 첨부가 있는 방과 방별 개수, 오른쪽은 고른 방의 파일.
  searchFileRooms: (token: string, keyword: string) =>
    request<ChatSearchRoomItem[]>(
      `/api/v1/chatRoom/search/file/room?keyword=${encodeURIComponent(keyword)}`,
      token,
    ),
  searchFiles: (token: string, keyword: string, roomId: number, cursor?: number) =>
    request<ChatSearchPage<ChatFileSearchItem>>(
      `/api/v1/chatRoom/search/file?keyword=${encodeURIComponent(keyword)}&chatRoomId=${roomId}${cursor ? `&cursor=${cursor}` : ""}`,
      token,
    ),
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
  // 공지 등록과 내리기. 둘 다 바뀐 뒤의 공지 목록 전체를 돌려줌.
  updateNotice: (token: string, roomId: number, messageId: number) =>
    request<ChatNotice[]>(
      `/api/v1/chatRoom/notice/update?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST" },
    ),
  removeNotice: (token: string, roomId: number, messageId: number) =>
    request<ChatNotice[]>(
      `/api/v1/chatRoom/notice/remove?chatRoomId=${roomId}&messageId=${messageId}`,
      token,
      { method: "POST" },
    ),
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
