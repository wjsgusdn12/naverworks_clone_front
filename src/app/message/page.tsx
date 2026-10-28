"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import {
  DELETE_EXPIRED_MESSAGE,
  EDIT_EXPIRED_MESSAGE,
  EDIT_WINDOW_HOURS,
  MessageActionMenu,
  REACTION_EXPIRED_MESSAGE,
  type MessageMenuPosition,
} from "@/components/chat/message-action-menu";
import { Tooltip } from "@/components/common/tooltip";
import { LoadingInline, LoadingState } from "@/components/common/loading";
import { ReactionEmoji } from "@/components/chat/reaction-emoji";
import { ReactionPicker } from "@/components/chat/reaction-picker";
import { MessageQuote } from "@/components/chat/message-quote";
import { MessageDeleteDialog } from "@/components/chat/message-change-dialog";
import {
  applyMessageChange,
  applyReactionChange,
  applyReadCursors,
  applyRoomMessageChange,
  type ReadState,
} from "@/lib/chat-message-state";
import { reactionLabel } from "@/lib/chat-reactions";
import { tokenizeMessage } from "@/lib/message-tokens";
import { useAuth } from "@/components/auth/auth-provider";
import {
  chatApi,
  type ChatMemberProfile,
  type ChatMessage,
  type ChatReadMember,
  type ChatRoom,
} from "@/lib/api/chat-api";
import {
  addressBookApi,
  type AddressBookMember,
  type AddressBookMemberDetail,
  type PresenceStatus,
} from "@/lib/api/address-book-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { connectChatRoom } from "@/lib/realtime/chat-realtime";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDown,
  ArrowDownUp,
  AtSign,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Forward,
  Reply,
  MoreVertical,
  Pin,
  EyeOff,
  LogOut,
  ImagePlus,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Search,
  SmilePlus,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Fragment,
  Suspense,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const dateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

// 연속 메시지를 시:분 단위로 묶어 프로필·시간 반복 표시를 줄임.
const minuteKey = (value: string) => {
  const date = new Date(value);
  return `${dateKey(value)}-${date.getHours()}-${date.getMinutes()}`;
};

const formatChatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));

const formatRoomTime = (value: string | null) => {
  if (!value) return "";
  const target = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000);
  if (dayDifference === 0)
    return target.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (dayDifference === 1) return "어제";
  return `${String(target.getMonth() + 1).padStart(2, "0")}. ${String(target.getDate()).padStart(2, "0")}.`;
};

// 마지막 대화가 있는 방은 그 시각, 새 방은 생성 시각을 기준으로 최신순을 유지.
const sortRoomsByLatestActivity = (rooms: ChatRoom[]) =>
  [...rooms].sort((left, right) => {
    // 고정한 방은 최근 활동 시각보다 항상 먼저 보여 줌.
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned)
      return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftTime = new Date(left.lastMessageAt ?? left.createdAt).getTime();
    const rightTime = new Date(right.lastMessageAt ?? right.createdAt).getTime();
    return rightTime - leftTime;
  });

type RoomSort = "LATEST" | "TYPE" | "UNREAD";
// 메시지 입력창 높이는 사용자가 손잡이로 조절할 때만 바뀌고, 내용이 넘치면 입력창 안에서 스크롤.
// 매 렌더마다 새로 만들어지는 함수를 늘 같은 참조로 감싸 줌.
// memo된 자식(메시지 목록)에 넘길 때 "함수가 바뀌었다"는 이유로 다시 그려지는 것을 막음.
function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}

// 보낸 지 24시간이 지나지 않은 메시지만 수정·삭제·리액션 가능(서버도 같은 기준으로 거부).
const isMessageEditable = (message: ChatMessage) =>
  Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_HOURS * 60 * 60 * 1000;

const DEFAULT_INPUT_HEIGHT = 144;
const MIN_INPUT_HEIGHT = 96;
const MAX_INPUT_HEIGHT = 400;
const clampInputHeight = (height: number) =>
  Math.round(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, height)));
// 같은 브라우저를 여러 계정이 써도 섞이지 않게 계정(membershipId)별 키로 저장.
const inputHeightStorageKey = (membershipId: number) =>
  `naverworks:messageInputHeight:${membershipId}`;
const readStoredInputHeight = (membershipId: number | undefined) => {
  if (typeof window === "undefined" || membershipId === undefined) return DEFAULT_INPUT_HEIGHT;
  try {
    const saved = Number(window.localStorage.getItem(inputHeightStorageKey(membershipId)));
    return saved ? clampInputHeight(saved) : DEFAULT_INPUT_HEIGHT;
  } catch {
    return DEFAULT_INPUT_HEIGHT;
  }
};
// 읽음/안 읽음 목록을 함께 보관해 탭 전환 시 다시 조회하지 않음.
type ReadModalState = {
  message: ChatMessage;
  readMembers: ChatReadMember[];
  unreadMembers: ChatReadMember[];
  read: boolean;
};
// 메시지에 리액션한 사람 목록 모달(누가 어떤 이모지를 눌렀는지).
type ReactionModalState = {
  message: ChatMessage;
  members: Awaited<ReturnType<typeof chatApi.reactionMembers>>;
};

const sortRooms = (rooms: ChatRoom[], sort: RoomSort) => {
  if (sort !== "UNREAD") return sortRoomsByLatestActivity(rooms);
  return [...rooms].sort((left, right) => {
    // 안 읽은 메시지 정렬에서도 고정한 방이 최우선.
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned)
      return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftHasUnread = left.unreadCount > 0;
    const rightHasUnread = right.unreadCount > 0;
    if (leftHasUnread !== rightHasUnread) return leftHasUnread ? -1 : 1;
    if (leftHasUnread && rightHasUnread) {
      // 첫 미확인 메시지가 더 오래된 방부터 확인하도록 오름차순 정렬.
      return (
        new Date(left.oldestUnreadMessageAt ?? left.lastMessageAt ?? left.createdAt).getTime() -
        new Date(right.oldestUnreadMessageAt ?? right.lastMessageAt ?? right.createdAt).getTime()
      );
    }
    return (
      new Date(right.lastMessageAt ?? right.createdAt).getTime() -
      new Date(left.lastMessageAt ?? left.createdAt).getTime()
    );
  });
};

export default function MessagePage() {
  // URL 쿼리(roomId)는 런타임 값이라 Suspense 경계 안에서 읽음.
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <MessageContent />
    </Suspense>
  );
}

function MessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoomId = Number(searchParams.get("roomId"));
  const requestedMemberIds = (searchParams.get("memberIds") ?? "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger);
  const { accessToken, member, status, logout } = useAuth();
  const { toast, showToast, dismissToast } = useToast();
  const { setActiveChatRoomId, syncChatRooms, refreshChatRooms, presenceByMembershipId } =
    useChatNotification();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  // 원문으로 이동한 경우, 누락 구간 없이 최신 대화까지 다음 페이지로 연결.
  const [newerCursor, setNewerCursor] = useState<number | null>(null);
  const newerCursorRef = useRef<number | null>(null);
  const loadingNewerRef = useRef(false);
  const [isLoadingNewerMessages, setIsLoadingNewerMessages] = useState(false);
  const [isLocatingOriginal, setIsLocatingOriginal] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [replyByRoomId, setReplyByRoomId] = useState<Record<number, ChatMessage>>({});
  const [editingMessage, setEditingMessage] = useState<{
    roomId: number;
    message: ChatMessage;
  } | null>(null);
  // 수정을 시작하기 전에 쓰던 입력 내용. 수정을 취소하면 되돌려 줌.
  const editDraftBackupRef = useRef<Record<number, string>>({});
  const [deletingMessage, setDeletingMessage] = useState<{
    roomId: number;
    message: ChatMessage;
  } | null>(null);
  const mutationScrollRef = useRef<{ top: number; height: number; adjustHeight: boolean } | null>(
    null,
  );
  const pendingMessageScrollRef = useRef<number | null>(null);
  const originalNavigationUntilRef = useRef(0);
  const messageWindowVersionRef = useRef(0);
  const sendingRef = useRef(false);
  const [isLoadingPreviousMessages, setIsLoadingPreviousMessages] = useState(false);
  // 방에 처음 들어가 메시지를 받아오는 동안 true. 빈 화면 대신 "불러오는 중" 안내를 보여 줌.
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  // 방 목록을 한 번이라도 받아왔는지. 받기 전에는 "방이 없다"는 안내를 띄우지 않기 위함.
  const [hasLoadedRooms, setHasLoadedRooms] = useState(false);
  const [draftByRoomId, setDraftByRoomId] = useState<Record<number, string>>({});
  const [typingMembers, setTypingMembers] = useState<
    Array<{ membershipId: number; displayName: string }>
  >([]);
  const [typingPreviewByRoomId, setTypingPreviewByRoomId] = useState<
    Record<number, Array<{ membershipId: number; displayName: string }>>
  >({});
  const [typingBubbleLeaving, setTypingBubbleLeaving] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [readModal, setReadModal] = useState<ReadModalState | null>(null);
  const [reactionModal, setReactionModal] = useState<ReactionModalState | null>(null);
  // 모달이 열린 동안 다른 사람의 리액션 변화가 오면 목록을 다시 불러오기 위한 현재 모달 메시지 id.
  const reactionModalMessageIdRef = useRef<number | null>(null);
  useEffect(() => {
    reactionModalMessageIdRef.current = reactionModal?.message.id ?? null;
  }, [reactionModal]);
  const [newRoomModalOpen, setNewRoomModalOpen] = useState(searchParams.get("create") === "group");
  const [contactMembers, setContactMembers] = useState<AddressBookMember[]>([]);
  const [roomManageOpen, setRoomManageOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [roomSort, setRoomSort] = useState<RoomSort>("LATEST");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [groupCategoryOpen, setGroupCategoryOpen] = useState(true);
  const [generalCategoryOpen, setGeneralCategoryOpen] = useState(true);
  const [roomMenuId, setRoomMenuId] = useState<number | null>(null);
  const [hideSelectionMode, setHideSelectionMode] = useState(false);
  const [hiddenRoomIds, setHiddenRoomIds] = useState<Set<number>>(new Set());
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false);
  const [notificationRoom, setNotificationRoom] = useState<ChatRoom | null>(null);
  const [selectedRoomProfile, setSelectedRoomProfile] = useState<ChatMemberProfile | null>(null);
  const [roomMentionMembers, setRoomMentionMembers] = useState<ChatMemberProfile[]>([]);
  const [profileMemberId, setProfileMemberId] = useState<number | null>(null);
  const [profileMember, setProfileMember] = useState<AddressBookMemberDetail | null>(null);
  const [scrollDateLabel, setScrollDateLabel] = useState<string | null>(null);
  const [scrollDatePhase, setScrollDatePhase] = useState<"visible" | "leaving">("visible");
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  // 사용자가 위쪽 메시지를 읽는 동안에는 가장 최근 수신 내용을 입력창 위 안내 행에 표시.
  const [latestUnseenMessage, setLatestUnseenMessage] = useState<{
    messageId: number;
    senderName: string;
    content: string;
  } | null>(null);
  // 최신 메시지 위치 여부를 버튼 UI와 실시간 수신 처리에서 함께 사용.
  const [isMessageListAtBottom, setIsMessageListAtBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const [composerHeight, setComposerHeight] = useState(160);
  const draftByRoomIdRef = useRef<Record<number, string>>({});
  const sendTypingRef = useRef<((typing: boolean) => void) | null>(null);
  const typingStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingActiveRef = useRef(false);
  const typingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiryTimerRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const typingMembersRef = useRef<Array<{ membershipId: number; displayName: string }>>([]);
  const typingPreviewTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const messageListRef = useRef<HTMLDivElement>(null);
  const isLoadingPreviousMessagesRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);
  // 사용자가 최신 메시지를 보고 있을 때만 새 대화를 따라간다.
  const isMessageListAtBottomRef = useRef(true);
  const preservedScrollRef = useRef<{ top: number; height: number } | null>(null);
  const activeDateKeyRef = useRef<string | null>(null);
  const scrollDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollDateFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedRoomIdRef = useRef<number | null>(selectedRoomId);
  // 현재 방 구성원별 읽은 위치. 말풍선 읽음 수는 이벤트마다 +1 하지 않고 이 값으로 다시 계산해 어긋나지 않게 함.
  const readStateRef = useRef<{ roomId: number | null; loaded: boolean; state: ReadState }>({
    roomId: null,
    loaded: false,
    state: { cursors: {}, memberIds: [] },
  });
  const roomsRef = useRef<ChatRoom[]>(rooms);
  const subscribedChatRoomIdsKey = useMemo(() => rooms.map((room) => room.id).join(","), [rooms]);
  // 방의 내용만 바뀌어도 소켓을 다시 열지 않도록 방 ID 집합만 연결 기준으로 사용.
  const subscribedChatRoomIds = useMemo(
    () => (subscribedChatRoomIdsKey ? subscribedChatRoomIdsKey.split(",").map(Number) : []),
    [subscribedChatRoomIdsKey],
  );
  const input = selectedRoomId ? (draftByRoomId[selectedRoomId] ?? "") : "";
  const replyTarget = selectedRoomId ? replyByRoomId[selectedRoomId] : undefined;
  // 현재 방에서 수정 중인 메시지. 답장과 같은 자리(입력칸 위)에 표시.
  const editingTarget =
    editingMessage && editingMessage.roomId === selectedRoomId ? editingMessage.message : null;
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    // 답장 인용의 높이가 달라져도 새 메시지 안내가 입력창을 덮지 않도록 측정.
    // +24는 입력창의 위아래 마진(my-3, 12px씩) 합계. 마진을 바꾸면 이 값도 같이 바꿔야 함.
    const observer = new ResizeObserver(() => setComposerHeight(composer.offsetHeight + 24));
    observer.observe(composer);
    return () => observer.disconnect();
  }, [selectedRoomId]);
  // 저장된 높이는 계정이 바뀔 때만 다시 읽고, 드래그 중인 높이는 현재 계정 값으로만 덮어씀.
  const currentMembershipId = member?.membershipId;
  const storedInputHeight = useMemo(
    () => readStoredInputHeight(currentMembershipId),
    [currentMembershipId],
  );
  const [draggedInputHeight, setDraggedInputHeight] = useState<{
    membershipId: number | undefined;
    height: number;
  } | null>(null);
  const inputHeight =
    draggedInputHeight && draggedInputHeight.membershipId === currentMembershipId
      ? draggedInputHeight.height
      : storedInputHeight;
  const inputResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const saveInputHeight = (height: number) => {
    if (currentMembershipId === undefined) return;
    try {
      localStorage.setItem(inputHeightStorageKey(currentMembershipId), String(height));
    } catch {
      /* 저장 실패는 무시. */
    }
  };
  const resizeInput = (height: number) => {
    setDraggedInputHeight({ membershipId: currentMembershipId, height: clampInputHeight(height) });
    // 최하단을 보던 중이면 입력창이 커져도 최신 메시지가 가려지지 않게 스크롤을 따라 내림.
    if (isMessageListAtBottomRef.current)
      requestAnimationFrame(() => {
        const list = messageListRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
  };
  // 멘션 후보는 주소록 전체가 아니라 현재 메시지방에 참여 중인 구성원으로 제한.
  const mentionCandidates = useMemo(() => {
    return roomMentionMembers.filter(
      (candidate) => candidate.membershipId !== member?.membershipId,
    );
  }, [member?.membershipId, roomMentionMembers]);
  const visibleMentionCandidates = useMemo(() => {
    if (mentionStartIndex === null) return [];
    const normalizedQuery = mentionQuery.toLocaleLowerCase();
    return [
      {
        membershipId: -1,
        displayName: "All",
        jobGradeName: "모든 멤버 멘션하기",
        departmentName: "",
      },
      ...mentionCandidates,
    ].filter((candidate) => candidate.displayName.toLocaleLowerCase().includes(normalizedQuery));
  }, [mentionCandidates, mentionQuery, mentionStartIndex]);
  // 탭 안에서 메시지 화면을 다시 열어도 마지막으로 보던 방을 복원.
  const lastRoomStorageKey = member ? `naverworks:message:lastRoom:${member.membershipId}` : null;
  // 반복 find를 피하도록 구성원 프로필을 화면 단위 Map으로 캐싱.
  const contactMemberById = useMemo(
    () =>
      new Map(
        contactMembers.map((contact) => [
          contact.membershipId,
          presenceByMembershipId[contact.membershipId] === undefined
            ? contact
            : {
                ...contact,
                presenceStatus: presenceByMembershipId[contact.membershipId]
                  ? "ONLINE"
                  : ("OFFLINE" as PresenceStatus),
              },
        ]),
      ),
    [contactMembers, presenceByMembershipId],
  );
  const openUserProfile = useCallback(
    (membershipId: number) => setProfileMemberId(membershipId),
    [],
  );

  useEffect(() => {
    // 늦게 도착한 이전 방 조회 응답이 현재 방 화면을 덮어쓰지 않게 보관.
    selectedRoomIdRef.current = selectedRoomId;
    // 방이 바뀌면 이전 방의 읽음 위치는 버리고 새로 받을 때까지 서버 값 그대로 둠.
    readStateRef.current = {
      roomId: selectedRoomId,
      loaded: false,
      state: { cursors: {}, memberIds: [] },
    };
  }, [selectedRoomId]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    syncChatRooms(rooms);
  }, [rooms, syncChatRooms]);

  useEffect(() => {
    setActiveChatRoomId(selectedRoomId);
    return () => setActiveChatRoomId(null);
  }, [selectedRoomId, setActiveChatRoomId]);

  useEffect(() => {
    draftByRoomIdRef.current = draftByRoomId;
  }, [draftByRoomId]);

  useEffect(() => {
    const closeRoomMenu = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-room-menu]")) {
        setRoomMenuId(null);
      }
    };
    document.addEventListener("mousedown", closeRoomMenu);
    return () => document.removeEventListener("mousedown", closeRoomMenu);
  }, []);

  useEffect(() => {
    if (!accessToken || !profileMemberId) {
      void Promise.resolve().then(() => setProfileMember(null));
      return;
    }
    // 목록 정보가 아닌 상세 API로 전화번호·입사일까지 동일하게 표시.
    void addressBookApi
      .memberDetail(accessToken, profileMemberId)
      .then(setProfileMember)
      .catch((error: Error) => showToast(error.message));
  }, [accessToken, profileMemberId, showToast]);

  useEffect(() => {
    const handleProfileAvatarClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-message-profile-name]",
      );
      if (!target) return;
      const displayName = target.dataset.messageProfileName;
      const profileTarget =
        contactMembers.find((contact) => contact.displayName === displayName) ??
        (member?.displayName === displayName ? member : null);
      if (!profileTarget) return;
      // 방 선택·구성원 체크보다 프로필 열기를 우선 처리.
      event.preventDefault();
      event.stopPropagation();
      openUserProfile(profileTarget.membershipId);
    };
    document.addEventListener("click", handleProfileAvatarClick, true);
    return () => document.removeEventListener("click", handleProfileAvatarClick, true);
  }, [contactMembers, member, openUserProfile]);

  const showDateChip = useCallback((label: string) => {
    if (scrollDateFadeTimerRef.current) clearTimeout(scrollDateFadeTimerRef.current);
    if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    setScrollDateLabel(label);
    setScrollDatePhase("visible");
    // 종료 직전에 투명도를 낮춘 뒤 DOM을 제거해 자연스럽게 사라지게 함.
    scrollDateFadeTimerRef.current = setTimeout(() => setScrollDatePhase("leaving"), 2600);
    scrollDateTimerRef.current = setTimeout(() => {
      setScrollDateLabel(null);
      activeDateKeyRef.current = null;
    }, 3000);
  }, []);

  const loadRooms = useCallback(async () => {
    if (!accessToken) return;
    let result: ChatRoom[];
    try {
      result = await refreshChatRooms();
    } finally {
      // 실패해도 "불러오는 중" 안내가 영원히 남지 않도록 완료 표시.
      setHasLoadedRooms(true);
    }
    setRooms(sortRoomsByLatestActivity(result));
    const savedRoomId =
      lastRoomStorageKey && typeof window !== "undefined"
        ? Number(window.sessionStorage.getItem(lastRoomStorageKey))
        : null;
    const requestedRoomExists = result.some((room) => room.id === requestedRoomId);
    const savedRoomExists = result.some((room) => room.id === savedRoomId);
    if (lastRoomStorageKey && savedRoomId && !savedRoomExists) {
      window.sessionStorage.removeItem(lastRoomStorageKey);
    }
    // URL로 직접 지정한 방을 우선하고, 없으면 탭 안에 저장한 마지막 방을 복원.
    setSelectedRoomId(
      (current) =>
        current ?? (requestedRoomExists ? requestedRoomId : savedRoomExists ? savedRoomId : null),
    );
  }, [accessToken, lastRoomStorageKey, requestedRoomId, refreshChatRooms]);

  // 목록에 메시지를 붙이거나 바꿀 때 읽음 수를 현재 읽은 위치 기준으로 맞춤.
  const withReadCounts = useCallback((list: ChatMessage[]) => {
    const read = readStateRef.current;
    return read.loaded && read.roomId === selectedRoomIdRef.current
      ? applyReadCursors(list, read.state)
      : list;
  }, []);
  // 방 상세(구성원·읽은 위치)를 받아 자동완성 목록과 읽음 계산 기준을 갱신.
  const loadReadState = useStableCallback(async (roomId: number) => {
    if (!accessToken) return;
    const detail = await chatApi.detail(accessToken, roomId);
    if (selectedRoomIdRef.current !== roomId) return;
    setRoomMentionMembers(detail.members);
    const read = readStateRef.current;
    const cursors = read.roomId === roomId ? { ...read.state.cursors } : {};
    // 상세 응답보다 먼저 도착한 실시간 읽음 이벤트가 있으면 더 앞선 위치를 유지.
    detail.readCursors.forEach((cursor) => {
      cursors[cursor.membershipId] = Math.max(
        cursor.lastReadMessageId ?? 0,
        cursors[cursor.membershipId] ?? 0,
      );
    });
    const state: ReadState = { cursors, memberIds: detail.memberIds };
    readStateRef.current = { roomId, loaded: true, state };
    setMessages((current) => applyReadCursors(current, state));
  });

  const applyChangedMessage = useCallback(
    (roomId: number, incoming: ChatMessage) => {
      setRooms((current) =>
        current.map((room) =>
          room.id === roomId
            ? applyRoomMessageChange(room, incoming, member?.membershipId ?? -1)
            : room,
        ),
      );
      if (selectedRoomIdRef.current === roomId) {
        const list = messageListRef.current;
        if (list && !isMessageListAtBottomRef.current && !mutationScrollRef.current) {
          const target = list.querySelector<HTMLElement>(`[data-message-id="${incoming.id}"]`);
          mutationScrollRef.current = {
            top: list.scrollTop,
            height: list.scrollHeight,
            adjustHeight: Boolean(
              target && target.getBoundingClientRect().bottom <= list.getBoundingClientRect().top,
            ),
          };
        }
        if (isMessageListAtBottomRef.current && newerCursorRef.current === null)
          shouldScrollToLatestRef.current = true;
        setMessages((current) => current.map((message) => applyMessageChange(message, incoming)));
        setLatestUnseenMessage((current) =>
          current?.messageId === incoming.id ? { ...current, content: incoming.content } : current,
        );
        setReadModal((current) =>
          current?.message.id === incoming.id
            ? incoming.deletedAt
              ? null
              : { ...current, message: incoming }
            : current,
        );
      }
      // 삭제된 원문을 새 답장 대상으로 보내지 않도록 입력창 미리보기도 갱신.
      setReplyByRoomId((current) =>
        Object.fromEntries(
          Object.entries(current)
            .filter(([, target]) => target.id !== incoming.id || !incoming.deletedAt)
            .map(([id, target]) => [id, target.id === incoming.id ? incoming : target]),
        ),
      );
      if (incoming.deletedAt) {
        setEditingMessage((current) => (current?.message.id === incoming.id ? null : current));
        setDeletingMessage((current) => (current?.message.id === incoming.id ? null : current));
      }
    },
    [member?.membershipId],
  );

  useEffect(() => {
    if (!lastRoomStorageKey || !selectedRoomId) return;
    window.sessionStorage.setItem(lastRoomStorageKey, String(selectedRoomId));
  }, [lastRoomStorageKey, selectedRoomId]);

  const loadMessages = useCallback(
    async (roomId: number, cursor?: number) => {
      if (!accessToken) return;
      if (cursor && isLoadingPreviousMessagesRef.current) return;
      const windowVersion = messageWindowVersionRef.current;

      // 이전 페이지 요청 전 높이를 기억해, 추가된 메시지 때문에 화면이 튀지 않게 함.
      const previousScroll =
        cursor && messageListRef.current
          ? {
              top: messageListRef.current.scrollTop,
              height: messageListRef.current.scrollHeight,
            }
          : null;

      if (cursor) {
        isLoadingPreviousMessagesRef.current = true;
        setIsLoadingPreviousMessages(true);
      } else {
        setIsLoadingMessages(true);
      }
      try {
        const result = await chatApi.messages(accessToken, roomId, cursor);
        if (
          selectedRoomIdRef.current !== roomId ||
          messageWindowVersionRef.current !== windowVersion
        )
          return;
        if (previousScroll) preservedScrollRef.current = previousScroll;
        // API 반환 순서와 무관하게 오래된 메시지부터 보여 최신 메시지가 항상 하단에 오게 함.
        const sortedMessages = [...result.messages].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
        setMessages((current) =>
          withReadCounts(
            cursor
              ? [
                  ...new Map(
                    [...sortedMessages, ...current].map((item) => [item.id, item]),
                  ).values(),
                ].sort((left, right) => left.id - right.id)
              : sortedMessages,
          ),
        );
        setNextCursor(result.nextCursor);
        if (!cursor) {
          newerCursorRef.current = result.newerCursor ?? null;
          setNewerCursor(result.newerCursor ?? null);
        }
        // 방에 들어오면 서버가 읽음 처리하므로 목록 배지도 즉시 함께 지움.
        if (!cursor)
          setRooms((current) =>
            current.map((room) => (room.id === roomId ? { ...room, unreadCount: 0 } : room)),
          );
      } finally {
        if (cursor) {
          isLoadingPreviousMessagesRef.current = false;
          setIsLoadingPreviousMessages(false);
        } else if (messageWindowVersionRef.current === windowVersion) {
          // 그 사이 다른 방으로 옮겼으면 새 방의 로딩 표시를 건드리지 않음.
          setIsLoadingMessages(false);
        }
      }
    },
    [accessToken, withReadCounts],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      markAuthenticationRequired();
      router.replace("/");
      return;
    }
    if (status === "authenticated")
      void Promise.resolve()
        .then(loadRooms)
        .catch((error: Error) => showToast(error.message));
  }, [loadRooms, router, showToast, status]);

  useEffect(() => {
    if (selectedRoomId) {
      messageWindowVersionRef.current += 1;
      newerCursorRef.current = null;
      pendingMessageScrollRef.current = null;
      originalNavigationUntilRef.current = 0;
      preservedScrollRef.current = null;
      mutationScrollRef.current = null;
      shouldScrollToLatestRef.current = true;
      isMessageListAtBottomRef.current = true;
      // 방 진입 직후 최신 메시지의 날짜를 짧게 안내.
      activeDateKeyRef.current = null;
      void Promise.resolve()
        .then(() => {
          // 이전 방의 DOM 높이와 스크롤 위치가 새 방에 이어지지 않게 초기화.
          setMessages([]);
          // 목록을 비운 직후 "메시지가 없다"는 안내가 잠깐 깜빡이지 않도록 먼저 로딩 상태로.
          setIsLoadingMessages(true);
          setNextCursor(null);
          setNewerCursor(null);
          setIsLocatingOriginal(false);
          setHighlightedMessageId(null);
          // 수정 중에 방을 옮기면 수정은 접고, 그 방의 입력칸은 수정 전 내용으로 되돌림.
          const backups = editDraftBackupRef.current;
          editDraftBackupRef.current = {};
          if (Object.keys(backups).length > 0)
            setDraftByRoomId((current) => ({ ...current, ...backups }));
          setEditingMessage(null);
          setDeletingMessage(null);
          setUnseenMessageCount(0);
          setLatestUnseenMessage(null);
          return loadMessages(selectedRoomId);
        })
        .catch((error: Error) => showToast(error.message));
    }
  }, [loadMessages, selectedRoomId, showToast]);

  useEffect(() => {
    if (!accessToken || !selectedRoomId || status !== "authenticated") return;
    const expiryTimers = typingExpiryTimerRef.current;
    const removeTypingMember = (membershipId: number) => {
      if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
      // 마지막 입력자가 멈출 때는 말풍선을 먼저 퇴장 애니메이션으로 보여 줌.
      const nextMembers = typingMembersRef.current.filter(
        (item) => item.membershipId !== membershipId,
      );
      typingMembersRef.current = nextMembers;
      if (nextMembers.length === 0) {
        setTypingBubbleLeaving(true);
        typingExitTimerRef.current = setTimeout(() => {
          setTypingMembers(nextMembers);
          setTypingBubbleLeaving(false);
        }, 180);
        return;
      }
      setTypingMembers(nextMembers);
    };
    // REST 전송 성공 응답과 같은 메시지는 id로 중복 삽입하지 않음.
    const connection = connectChatRoom({
      accessToken,
      chatRoomId: selectedRoomId,
      subscribedChatRoomIds,
      onMessageCreated: (event) => {
        const incoming = event.message;
        if (incoming.senderMembershipId !== member?.membershipId) {
          // 현재 보고 있는 방의 새 수신 메시지는 목록 배지와 서버 읽음 위치를 함께 정리.
          void chatApi.markRead(accessToken, event.chatRoomId).catch(() => undefined);
        }
        // 초대·퇴장 같은 시스템 안내는 구성원이 바뀐 신호이므로 읽음 계산 기준을 다시 받음.
        if (incoming.type !== "TEXT") void loadReadState(event.chatRoomId).catch(() => undefined);
        setMessages((current) => {
          if (current.some((message) => message.id === incoming.id)) return current;
          // 과거 원문 구간에서는 새 메시지를 바로 붙이면 중간 대화가 빠지므로 안내만 표시.
          if (newerCursorRef.current !== null) {
            setUnseenMessageCount((count) => count + 1);
            setLatestUnseenMessage({
              messageId: incoming.id,
              senderName: incoming.senderName,
              content: incoming.content,
            });
            return current;
          }
          if (
            incoming.senderMembershipId === member?.membershipId ||
            isMessageListAtBottomRef.current
          ) {
            shouldScrollToLatestRef.current = true;
          } else {
            // 위쪽 대화를 읽는 중이면 위치를 유지하고 새 메시지 안내만 표시.
            setUnseenMessageCount((count) => count + 1);
            setLatestUnseenMessage({
              messageId: incoming.id,
              senderName: incoming.senderName,
              content: incoming.content,
            });
          }
          // 메시지보다 먼저 도착한 읽음 이벤트가 있어도 붙이는 시점에 읽은 위치로 계산해 빠뜨리지 않음.
          return withReadCounts([...current, incoming]);
        });
      },
      onRoomMessageCreated: (event) => {
        const incoming = event.message;
        setRooms((current) =>
          current.map((room) => {
            if (room.id !== event.chatRoomId) return room;
            const shouldIncreaseUnread =
              incoming.type === "TEXT" &&
              incoming.senderMembershipId !== member?.membershipId &&
              event.chatRoomId !== selectedRoomId;
            const isOpenRoom = event.chatRoomId === selectedRoomId;
            return {
              ...room,
              lastMessage: incoming.content,
              lastMessageId: incoming.id,
              lastMessageVersion: incoming.version,
              lastMessageAt: incoming.createdAt,
              lastSenderMembershipId: incoming.senderMembershipId,
              lastMessageMentioned: incoming.mentionedMembershipIds.includes(
                member?.membershipId ?? -1,
              ),
              unreadCount: isOpenRoom
                ? 0
                : shouldIncreaseUnread
                  ? room.unreadCount + 1
                  : room.unreadCount,
              oldestUnreadMessageAt: isOpenRoom
                ? null
                : shouldIncreaseUnread
                  ? (room.oldestUnreadMessageAt ?? incoming.createdAt)
                  : room.oldestUnreadMessageAt,
            };
          }),
        );
      },
      onMessageChanged: (event) => {
        applyChangedMessage(event.chatRoomId, event.message);
        if (event.message.deletedAt)
          void loadRooms().catch(() =>
            showToast("메시지는 삭제됐으나 목록을 새로 불러오지 못했습니다."),
          );
      },
      // 리액션은 변화분만 받아 해당 메시지의 집계에 더하거나 뺌.
      onReactionChanged: (event) => {
        const myMembershipId = member?.membershipId;
        if (myMembershipId === undefined) return;
        setMessages((current) =>
          current.map((item) =>
            item.id === event.messageId
              ? {
                  ...item,
                  reactions: applyReactionChange(item.reactions ?? [], event, myMembershipId),
                }
              : item,
          ),
        );
        // 리액션 사용자 모달이 이 메시지로 열려 있으면 누가 어떤 이모지를 눌렀는지도 바로 갱신.
        if (reactionModalMessageIdRef.current === event.messageId && accessToken) {
          void chatApi
            .reactionMembers(accessToken, selectedRoomId, event.messageId)
            .then((members) =>
              setReactionModal((current) =>
                current?.message.id === event.messageId ? { ...current, members } : current,
              ),
            )
            .catch(() => undefined);
        }
      },
      onReadUpdated: (event) => {
        if (event.chatRoomId !== selectedRoomId) return;
        const read = readStateRef.current;
        if (read.roomId !== selectedRoomId) return;
        // 읽은 위치는 앞으로만 가므로 같은 사람의 이벤트가 몇 번 와도 결과가 같음.
        read.state = {
          ...read.state,
          cursors: {
            ...read.state.cursors,
            [event.readerMembershipId]: Math.max(
              read.state.cursors[event.readerMembershipId] ?? 0,
              event.lastReadMessageId,
            ),
          },
        };
        // 구성원 목록을 아직 못 받았으면 위치만 기억해 두고, 받은 뒤 한꺼번에 계산.
        if (!read.loaded) return;
        setMessages((current) => applyReadCursors(current, read.state));
      },
      onTypingChanged: (event) => {
        if (event.membershipId === member?.membershipId) return;
        if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
        setTypingBubbleLeaving(false);
        const previousTimer = expiryTimers.get(event.membershipId);
        if (previousTimer) clearTimeout(previousTimer);
        if (!event.typing) {
          expiryTimers.delete(event.membershipId);
          removeTypingMember(event.membershipId);
          return;
        }
        setTypingMembers((current) => {
          const withoutSender = current.filter((item) => item.membershipId !== event.membershipId);
          const nextMembers = [
            ...withoutSender,
            {
              membershipId: event.membershipId,
              displayName: event.displayName,
            },
          ];
          typingMembersRef.current = nextMembers;
          return nextMembers;
        });
        // 브라우저 강제 종료처럼 종료 이벤트가 오지 않아도 표시를 정리.
        expiryTimers.set(
          event.membershipId,
          setTimeout(() => {
            expiryTimers.delete(event.membershipId);
            removeTypingMember(event.membershipId);
          }, 3_000),
        );
      },
      onGlobalTypingChanged: (event) => {
        if (event.membershipId === member?.membershipId) return;
        const timerKey = `${event.chatRoomId}:${event.membershipId}`;
        const previousTimer = typingPreviewTimerRef.current.get(timerKey);
        if (previousTimer) clearTimeout(previousTimer);

        const removePreview = () => {
          typingPreviewTimerRef.current.delete(timerKey);
          setTypingPreviewByRoomId((current) => {
            const currentMembers = current[event.chatRoomId] ?? [];
            const nextMembers = currentMembers.filter(
              (item) => item.membershipId !== event.membershipId,
            );
            if (nextMembers.length === 0) {
              const remainingRooms = { ...current };
              delete remainingRooms[event.chatRoomId];
              return remainingRooms;
            }
            return { ...current, [event.chatRoomId]: nextMembers };
          });
        };

        if (!event.typing) {
          removePreview();
          return;
        }
        setTypingPreviewByRoomId((current) => {
          const currentMembers = current[event.chatRoomId] ?? [];
          const nextMembers = [
            ...currentMembers.filter((item) => item.membershipId !== event.membershipId),
            { membershipId: event.membershipId, displayName: event.displayName },
          ];
          return { ...current, [event.chatRoomId]: nextMembers };
        });
        // 입력 종료 이벤트를 놓쳐도 목록 미리보기는 자동으로 복구.
        typingPreviewTimerRef.current.set(timerKey, setTimeout(removePreview, 3_000));
      },
      onConnected: (sendTyping) => {
        sendTypingRef.current = sendTyping;
        // 방을 다시 열어도 남아 있는 초안이 있으면 입력 상태를 즉시 복구.
        if (!draftByRoomIdRef.current[selectedRoomId]?.trim()) return;
        sendTyping(true);
        typingActiveRef.current = true;
        if (!typingHeartbeatRef.current) {
          typingHeartbeatRef.current = setInterval(() => sendTyping(true), 2_000);
        }
      },
      // 연결 실패는 REST 메시지 기능을 막지 않으므로 조용히 복구를 시도.
      onError: () => undefined,
    });
    sendTypingRef.current = connection.sendTyping;
    return () => {
      connection.sendTyping(false);
      connection.disconnect();
      sendTypingRef.current = null;
      if (typingStartTimerRef.current) clearTimeout(typingStartTimerRef.current);
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      typingActiveRef.current = false;
      if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
      expiryTimers.forEach(clearTimeout);
      expiryTimers.clear();
      typingMembersRef.current = [];
      setTypingMembers([]);
    };
  }, [
    accessToken,
    member?.membershipId,
    selectedRoomId,
    status,
    subscribedChatRoomIds,
    applyChangedMessage,
    loadReadState,
    loadRooms,
    showToast,
    withReadCounts,
  ]);

  useEffect(
    () => () => {
      // 화면을 완전히 떠날 때만 모든 목록 입력 상태 타이머를 정리.
      const timers = typingPreviewTimerRef.current;
      timers.forEach(clearTimeout);
      timers.clear();
    },
    [],
  );

  useEffect(() => {
    if (
      !accessToken ||
      !selectedRoomId ||
      !["DIRECT", "SELF"].includes(selectedRoom?.type ?? "") ||
      !member
    ) {
      // 이전 1:1 방의 프로필이 새 방에 잠깐 보이지 않도록 초기화.
      void Promise.resolve().then(() => setSelectedRoomProfile(null));
      return;
    }
    // 채팅방 참여자 목록으로 상단에 표시할 상대/본인 프로필을 확정.
    void chatApi
      .detail(accessToken, selectedRoomId)
      .then((detail) => {
        const profile =
          selectedRoom?.type === "SELF"
            ? detail.members.find((item) => item.membershipId === member.membershipId)
            : detail.members.find((item) => item.membershipId !== member.membershipId);
        setSelectedRoomProfile(profile ?? null);
        setRooms((current) =>
          current.map((room) => (room.id === detail.room.id ? detail.room : room)),
        );
      })
      .catch((error: Error) => showToast(error.message));
  }, [accessToken, member, selectedRoom?.type, selectedRoomId, showToast]);

  useEffect(() => {
    if (!accessToken || !selectedRoomId) {
      void Promise.resolve().then(() => setRoomMentionMembers([]));
      return;
    }
    // 방 전환 중 이전 방 참여자가 자동완성에 잠깐 남지 않게 새 상세 정보(구성원·읽은 위치)로 교체.
    void loadReadState(selectedRoomId).catch(() => setRoomMentionMembers([]));
  }, [accessToken, selectedRoomId, loadReadState]);

  // 새 메시지·방 진입 결과가 렌더링되면 항상 가장 최근 대화가 보이도록 이동.
  useEffect(() => {
    if (!messageListRef.current) return;
    const messageList = messageListRef.current;
    const targetId = pendingMessageScrollRef.current;
    if (targetId !== null) {
      const frameId = requestAnimationFrame(() => {
        const target = messageList.querySelector<HTMLElement>(`[data-message-id="${targetId}"]`);
        if (!target) return;
        const bubble = target.querySelector<HTMLElement>("[data-message-bubble]") ?? target;
        const bubbleBounds = bubble.getBoundingClientRect();
        const listBounds = messageList.getBoundingClientRect();
        // 이미 화면 안에 보이는 원문은 제자리에서 강조. 화면 밖일 때만 스크롤 이동.
        const isVisible =
          bubbleBounds.top >= listBounds.top + 8 && bubbleBounds.bottom <= listBounds.bottom - 8;
        if (!isVisible) {
          const top =
            bubbleBounds.top -
            listBounds.top +
            messageList.scrollTop -
            Math.max(8, (messageList.clientHeight - bubbleBounds.height) / 2);
          messageList.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        }
        pendingMessageScrollRef.current = null;
        preservedScrollRef.current = null;
        shouldScrollToLatestRef.current = false;
        setHighlightedMessageId(targetId);
      });
      return () => cancelAnimationFrame(frameId);
    }
    const mutationScroll = mutationScrollRef.current;
    if (mutationScroll) {
      const frameId = requestAnimationFrame(() => {
        messageList.scrollTop =
          mutationScroll.top +
          (mutationScroll.adjustHeight ? messageList.scrollHeight - mutationScroll.height : 0);
        mutationScrollRef.current = null;
      });
      return () => cancelAnimationFrame(frameId);
    }
    const preservedScroll = preservedScrollRef.current;
    if (preservedScroll) {
      const frameId = requestAnimationFrame(() => {
        messageList.scrollTop =
          preservedScroll.top + messageList.scrollHeight - preservedScroll.height;
        preservedScrollRef.current = null;
      });
      return () => cancelAnimationFrame(frameId);
    }
    // 방 전환 직후 빈 목록에서는 플래그를 소비하지 않고, 실제 메시지가 렌더링된 뒤 최하단으로 이동.
    if (!shouldScrollToLatestRef.current || messages.length === 0) return;
    const frameId = requestAnimationFrame(() => {
      // 새 방의 메시지 DOM 높이가 계산된 뒤 최하단으로 이동.
      messageList.scrollTop = messageList.scrollHeight;
      shouldScrollToLatestRef.current = false;
      isMessageListAtBottomRef.current = true;
      setIsMessageListAtBottom(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, [messages]);

  useEffect(() => {
    if (highlightedMessageId === null) return;
    const row = messageListRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${highlightedMessageId}"]`,
    );
    const bubble = row?.querySelector<HTMLElement>("[data-message-bubble]");
    if (!bubble) return;

    // 시간으로 해제하지 않고 선택한 말풍선 밖을 누를 때만 테두리 해제.
    const clearHighlightOutside = (event: PointerEvent) => {
      if (!bubble.contains(event.target as Node)) setHighlightedMessageId(null);
    };
    document.addEventListener("pointerdown", clearHighlightOutside, true);
    return () => {
      document.removeEventListener("pointerdown", clearHighlightOutside, true);
    };
  }, [highlightedMessageId, selectedRoomId]);

  useEffect(() => {
    if (!shouldScrollToLatestRef.current || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    activeDateKeyRef.current = dateKey(latestMessage.createdAt);
    showDateChip(formatChatDate(latestMessage.createdAt));
  }, [messages, showDateChip]);

  useEffect(() => {
    if (typingMembers.length === 0 || !messageListRef.current || !isMessageListAtBottomRef.current)
      return;
    const messageList = messageListRef.current;
    // 입력 중 말풍선도 최신 대화 흐름이므로 표시 즉시 하단으로 포커스.
    const frameId = requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
    return () => cancelAnimationFrame(frameId);
  }, [typingMembers]);

  useEffect(() => {
    if (!accessToken || status !== "authenticated") return;
    void Promise.resolve()
      .then(async () => {
        const result = await addressBookApi.member(
          accessToken,
          new URLSearchParams({
            page: "0",
            size: "100",
            sort: "name",
            direction: "asc",
            allCompany: "true",
          }),
        );
        setContactMembers(
          result.content.filter(
            (target) => target.membershipId !== member?.membershipId && target.enabled,
          ),
        );
      })
      .catch((error: Error) => showToast(error.message));
  }, [accessToken, member?.membershipId, showToast, status]);

  const filteredRooms = sortRooms(
    rooms.filter((room) =>
      `${room.name ?? ""} ${room.directDisplayName ?? ""} ${room.type === "SELF" ? (member?.displayName ?? "") : ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    roomSort,
  );
  const groupRooms = filteredRooms.filter((room) => room.type === "GROUP");
  const generalRooms = filteredRooms.filter((room) => room.type !== "GROUP");
  // 방 항목(memo)에 넘기는 콜백은 방마다 새로 만들지 않고 고정 함수 하나를 공유(방 ID를 인자로 받음).
  const selectRoom = useCallback((roomId: number) => setSelectedRoomId(roomId), []);
  const toggleRoomMenu = useCallback(
    (roomId: number) => setRoomMenuId((current) => (current === roomId ? null : roomId)),
    [],
  );
  const toggleHiddenRoom = useCallback(
    (roomId: number) =>
      setHiddenRoomIds((current) => {
        const next = new Set(current);
        if (next.has(roomId)) next.delete(roomId);
        else next.add(roomId);
        return next;
      }),
    [],
  );
  const handleRoomAction = useStableCallback(
    async (room: ChatRoom, action: "notification" | "pin" | "hide" | "leave") => {
      if (!accessToken) return;
      setRoomMenuId(null);
      if (action === "hide") {
        setHideSelectionMode(true);
        setHiddenRoomIds(new Set([room.id]));
        return;
      }
      if (action === "leave") {
        await chatApi.leave(accessToken, room.id);
        setRooms((current) => current.filter((target) => target.id !== room.id));
        if (selectedRoomId === room.id) setSelectedRoomId(null);
        showToast("채팅방에서 나갔습니다.");
        return;
      }
      if (action === "pin") {
        await chatApi.togglePin(accessToken, room.id);
        await loadRooms();
        showToast(room.pinned ? "고정을 해제했습니다." : "채팅방을 고정했습니다.");
        return;
      }
      setNotificationRoom(room);
    },
  );
  const renderRoomItem = (room: ChatRoom) => (
    <MessageRoomItem
      key={room.id}
      room={room}
      currentMember={member}
      contactMemberById={contactMemberById}
      isSelected={selectedRoomId === room.id}
      typingPreviewLabel={(() => {
        const roomTypingMembers = typingPreviewByRoomId[room.id] ?? [];
        if (roomTypingMembers.length === 0) return null;
        return room.type === "GROUP" && roomTypingMembers.length > 1
          ? `${roomTypingMembers[0].displayName} 외 ${roomTypingMembers.length - 1}명이 입력 중입니다`
          : `${roomTypingMembers[0].displayName}님이 입력 중입니다`;
      })()}
      isCollapsed={isSidebarCollapsed}
      onSelect={selectRoom}
      onProfileClick={openUserProfile}
      menuOpen={roomMenuId === room.id}
      hideSelectionMode={hideSelectionMode}
      hiddenSelected={hiddenRoomIds.has(room.id)}
      onToggleMenu={toggleRoomMenu}
      onToggleHidden={toggleHiddenRoom}
      onAction={handleRoomAction}
    />
  );
  const displayRoomName = (room: ChatRoom) =>
    room.type === "SELF"
      ? `[나] ${member?.displayName ?? "나"}`
      : room.type === "DIRECT"
        ? (room.directDisplayName ?? "사용자")
        : (room.name ?? "그룹 메시지");
  const directProfile =
    selectedRoom?.type === "SELF"
      ? member
      : contactMemberById.get(selectedRoom?.directMembershipId ?? -1);
  // 로그인 사용자와 주소록 사용자는 상세 필드가 달라 주소록 프로필만 별도로 사용.
  const addressBookProfile =
    directProfile && "jobGradeName" in directProfile ? directProfile : null;
  // 1:1 방 헤더는 목록 API가 제공한 상대방 정보를 우선 사용. 내 정보로 대체하지 않음.
  const headerProfile =
    selectedRoom?.type === "SELF"
      ? {
          displayName: selectedRoomProfile?.displayName ?? member?.displayName ?? "나",
          jobGradeName: selectedRoomProfile?.jobGradeName ?? "",
          departmentName: selectedRoomProfile?.departmentName ?? "",
          companyName: selectedRoomProfile?.companyName ?? "",
        }
      : selectedRoom?.type === "DIRECT"
        ? {
            displayName:
              selectedRoomProfile?.displayName ??
              addressBookProfile?.displayName ??
              selectedRoom.directDisplayName ??
              "상대 사용자",
            jobGradeName:
              selectedRoomProfile?.jobGradeName ??
              addressBookProfile?.jobGradeName ??
              selectedRoom.directJobGradeName ??
              "",
            departmentName:
              selectedRoomProfile?.departmentName ??
              addressBookProfile?.departmentName ??
              selectedRoom.directDepartmentName ??
              "",
            companyName:
              selectedRoomProfile?.companyName ??
              addressBookProfile?.companyName ??
              selectedRoom.directCompanyName ??
              "",
          }
        : null;
  const headerMembershipId =
    selectedRoom?.type === "SELF" ? member?.membershipId : selectedRoom?.directMembershipId;

  const copyMessage = async (message: ChatMessage) => {
    try {
      // 화면의 말줄임·멘션 스타일과 무관하게 원문과 줄바꿈을 그대로 복사.
      await navigator.clipboard.writeText(message.content);
      showToast("메시지를 복사했습니다.");
    } catch {
      showToast("메시지를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const startReply = (message: ChatMessage) => {
    if (!selectedRoomId) return;
    // 답장과 수정은 입력칸을 같이 쓰므로 둘 중 하나만 켜 둠.
    if (editingTarget) cancelEdit();
    setReplyByRoomId((current) => ({ ...current, [selectedRoomId]: message }));
    setMentionStartIndex(null);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const cancelReply = () => {
    if (!selectedRoomId) return;
    setReplyByRoomId((current) => {
      const next = { ...current };
      delete next[selectedRoomId];
      return next;
    });
    inputRef.current?.focus({ preventScroll: true });
  };

  // 답장하기와 같은 흐름: 입력칸 위에 원문을 띄우고, 입력칸에는 기존 본문을 채워 바로 고치게 함.
  const startEdit = (message: ChatMessage) => {
    if (!selectedRoomId || message.deletedAt || message.senderMembershipId !== member?.membershipId)
      return;
    // 메뉴가 열려 있는 사이에 24시간이 지났을 수도 있으므로 시작 시점에 한 번 더 확인.
    if (!isMessageEditable(message)) {
      showToast(EDIT_EXPIRED_MESSAGE);
      return;
    }
    const roomId = selectedRoomId;
    if (!(roomId in editDraftBackupRef.current))
      editDraftBackupRef.current[roomId] = draftByRoomId[roomId] ?? "";
    setReplyByRoomId((current) => {
      if (!current[roomId]) return current;
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    setDraftByRoomId((current) => ({ ...current, [roomId]: message.content }));
    setMentionStartIndex(null);
    setEditingMessage({ roomId, message });
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(message.content.length, message.content.length);
    });
  };

  // 수정 취소: 입력칸을 수정 전 내용으로 되돌림.
  const cancelEdit = () => {
    if (!editingMessage) return;
    const roomId = editingMessage.roomId;
    const backup = editDraftBackupRef.current[roomId] ?? "";
    delete editDraftBackupRef.current[roomId];
    setDraftByRoomId((current) => {
      const next = { ...current };
      if (backup) next[roomId] = backup;
      else delete next[roomId];
      return next;
    });
    setEditingMessage(null);
    inputRef.current?.focus({ preventScroll: true });
  };
  const startDelete = (message: ChatMessage) => {
    if (!selectedRoomId || message.deletedAt || message.senderMembershipId !== member?.membershipId)
      return;
    if (!isMessageEditable(message)) {
      showToast(DELETE_EXPIRED_MESSAGE);
      return;
    }
    setDeletingMessage({ roomId: selectedRoomId, message });
  };
  const deletingMessageId = deletingMessage?.message.id;
  const closeDelete = useCallback(
    () =>
      setDeletingMessage((current) => (current?.message.id === deletingMessageId ? null : current)),
    [deletingMessageId],
  );

  const saveEditedMessage = async (content: string) => {
    if (!accessToken || !editingMessage) throw new Error("로그인 상태를 확인해 주세요.");
    const { roomId, message } = editingMessage;
    const mentionedIds = content.includes("@All")
      ? mentionCandidates.map((candidate) => candidate.membershipId)
      : mentionCandidates
          .filter((candidate) => content.includes(`@${candidate.displayName}`))
          .map((candidate) => candidate.membershipId);
    const result = await chatApi.updateMessage(
      accessToken,
      roomId,
      message.id,
      content,
      mentionedIds,
      message.version ?? 0,
    );
    applyChangedMessage(roomId, result);
    showToast("메시지를 수정했습니다.");
  };
  const deleteSelectedMessage = async () => {
    if (!accessToken || !deletingMessage) throw new Error("로그인 상태를 확인해 주세요.");
    const { roomId, message } = deletingMessage;
    const result = await chatApi.deleteMessage(
      accessToken,
      roomId,
      message.id,
      message.version ?? 0,
    );
    applyChangedMessage(roomId, result);
    showToast("메시지를 삭제했습니다.");
    await loadRooms().catch(() => showToast("삭제는 완료했으나 목록을 새로 불러오지 못했습니다."));
  };

  const jumpToOriginal = async (messageId: number) => {
    if (!accessToken || !selectedRoomId || isLocatingOriginal) return;
    const roomId = selectedRoomId;
    const windowVersion = ++messageWindowVersionRef.current;
    shouldScrollToLatestRef.current = false;
    preservedScrollRef.current = null;
    originalNavigationUntilRef.current = Date.now() + 800;
    isMessageListAtBottomRef.current = false;
    setIsMessageListAtBottom(false);
    setHighlightedMessageId(null);
    try {
      if (messages.some((item) => item.id === messageId)) {
        pendingMessageScrollRef.current = messageId;
        setMessages((current) => [...current]);
        return;
      }
      setIsLocatingOriginal(true);
      const page = await chatApi.messageAnchor(accessToken, roomId, messageId);
      if (selectedRoomIdRef.current !== roomId || messageWindowVersionRef.current !== windowVersion)
        return;
      newerCursorRef.current = page.newerCursor;
      setNewerCursor(page.newerCursor);
      setNextCursor(page.nextCursor);
      pendingMessageScrollRef.current = messageId;
      originalNavigationUntilRef.current = Date.now() + 800;
      setMessages(page.messages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "원문 메시지로 이동하지 못했습니다.");
    } finally {
      if (messageWindowVersionRef.current === windowVersion) setIsLocatingOriginal(false);
    }
  };

  // 수정 중이면 Enter가 새 메시지 전송이 아니라 저장으로 동작.
  const submitEdit = async () => {
    if (!editingMessage || sendingRef.current) return;
    const content = input.trim();
    if (!content || content.length > 2000) {
      showToast("메시지는 1~2,000자로 입력해 주세요.");
      return;
    }
    const roomId = editingMessage.roomId;
    sendingRef.current = true;
    try {
      stopTyping();
      await saveEditedMessage(content);
      delete editDraftBackupRef.current[roomId];
      setDraftByRoomId((current) => {
        const next = { ...current };
        delete next[roomId];
        return next;
      });
      setEditingMessage(null);
      inputRef.current?.focus({ preventScroll: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지를 수정하지 못했습니다.");
    } finally {
      sendingRef.current = false;
    }
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (editingTarget) {
      await submitEdit();
      return;
    }
    if (!accessToken || !selectedRoomId || !input.trim() || sendingRef.current) return;
    // 전송 중 방을 바꿔도 응답·초기화는 전송을 시작한 방에만 적용.
    const roomId = selectedRoomId;
    const sentInput = input;
    const sentReplyId = replyTarget?.id;
    sendingRef.current = true;
    try {
      stopTyping();
      const mentionedMembershipIds = input.includes("@All")
        ? mentionCandidates.map((candidate) => candidate.membershipId)
        : mentionCandidates
            .filter((candidate) => input.includes(`@${candidate.displayName}`))
            .map((candidate) => candidate.membershipId);
      const message = await chatApi.send(
        accessToken,
        roomId,
        input.trim(),
        mentionedMembershipIds,
        sentReplyId,
      );
      if (selectedRoomIdRef.current === roomId) {
        shouldScrollToLatestRef.current = true;
        isMessageListAtBottomRef.current = true;
        setUnseenMessageCount(0);
        setLatestUnseenMessage(null);
        if (newerCursorRef.current !== null) {
          // 과거 구간에서 전송했다면 최신 페이지로 돌아와 대화 간격을 메움.
          messageWindowVersionRef.current += 1;
          pendingMessageScrollRef.current = null;
          preservedScrollRef.current = null;
          setIsLocatingOriginal(false);
          void loadMessages(roomId).catch(() =>
            showToast("전송은 완료했으나 최신 대화를 불러오지 못했습니다."),
          );
        } else {
          // REST 응답과 STOMP 수신이 겹쳐도 같은 ID의 말풍선은 한 번만 추가.
          setMessages((current) =>
            current.some((item) => item.id === message.id)
              ? current
              : withReadCounts([...current, message]),
          );
        }
      }
      setRooms((current) =>
        sortRoomsByLatestActivity(
          current.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  lastMessage: message.content,
                  lastMessageId: message.id,
                  lastMessageVersion: message.version,
                  lastMessageAt: message.createdAt,
                  lastSenderMembershipId: member?.membershipId ?? null,
                  unreadCount: 0,
                }
              : room,
          ),
        ),
      );
      setDraftByRoomId((current) => {
        if (current[roomId] !== sentInput) return current;
        const remainingDrafts = { ...current };
        delete remainingDrafts[roomId];
        return remainingDrafts;
      });
      setReplyByRoomId((current) => {
        if (current[roomId]?.id !== sentReplyId) return current;
        const next = { ...current };
        delete next[roomId];
        return next;
      });
      if (selectedRoomIdRef.current === roomId) inputRef.current?.focus({ preventScroll: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지를 보내지 못했습니다.");
    } finally {
      sendingRef.current = false;
    }
  };

  const stopTyping = () => {
    if (typingStartTimerRef.current) clearTimeout(typingStartTimerRef.current);
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    if (typingActiveRef.current) sendTypingRef.current?.(false);
    typingStartTimerRef.current = null;
    typingHeartbeatRef.current = null;
    typingActiveRef.current = false;
  };

  const handleMessageInput = (value: string, cursorPosition = value.length) => {
    if (!selectedRoomId) return;
    // 커서 앞의 마지막 @만 자동완성 대상으로 취급해 이메일 주소 등은 방해하지 않음.
    const beforeCursor = value.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf("@");
    const mentionText = atIndex >= 0 ? beforeCursor.slice(atIndex + 1) : "";
    const canOpenMention =
      atIndex >= 0 &&
      !/[\s@]/.test(mentionText) &&
      (atIndex === 0 || /\s/.test(beforeCursor[atIndex - 1]));
    setMentionStartIndex(canOpenMention ? atIndex : null);
    setMentionQuery(canOpenMention ? mentionText : "");
    setMentionHighlightIndex(0);
    setDraftByRoomId((current) => {
      if (value) return { ...current, [selectedRoomId]: value };
      {
        const remainingDrafts = { ...current };
        delete remainingDrafts[selectedRoomId];
        return remainingDrafts;
      }
    });

    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (typingActiveRef.current || typingStartTimerRef.current) return;
    // 입력값이 남아 있는 동안 heartbeat로 상대방 표시를 유지.
    typingStartTimerRef.current = setTimeout(() => {
      if (!inputRef.current?.value.trim()) return;
      sendTypingRef.current?.(true);
      typingActiveRef.current = true;
      typingHeartbeatRef.current = setInterval(() => sendTypingRef.current?.(true), 2_000);
    }, 500);
  };

  const selectMention = (candidate: { membershipId: number; displayName: string }) => {
    if (!selectedRoomId || mentionStartIndex === null) return;
    const mentionText = candidate.membershipId === -1 ? "@All" : `@${candidate.displayName}`;
    const nextValue = `${input.slice(0, mentionStartIndex)}${mentionText} ${input.slice(mentionStartIndex + mentionQuery.length + 1)}`;
    handleMessageInput(nextValue, mentionStartIndex + mentionText.length + 1);
    setMentionStartIndex(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        mentionStartIndex + mentionText.length + 1,
        mentionStartIndex + mentionText.length + 1,
      );
    });
  };

  const openReadMembers = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId || message.type !== "TEXT") return;
    try {
      // 두 탭을 동시에 조회해 탭 숫자를 바로 보여주고, 탭 전환 때는 추가 요청 없이 즉시 바꿈.
      const [readMembers, unreadMembers] = await Promise.all([
        chatApi.readMembers(accessToken, selectedRoomId, message.id, true),
        chatApi.readMembers(accessToken, selectedRoomId, message.id, false),
      ]);
      setReadModal({ message, readMembers, unreadMembers, read: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "읽음 멤버를 조회하지 못했습니다.");
    }
  };

  // 리액션 추가/취소: 화면에 먼저 반영(낙관적)하고, 서버 응답으로 확정. 실패하면 서버 집계로 되돌림.
  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!accessToken || !selectedRoomId || !member || message.deletedAt || message.type !== "TEXT")
      return;
    if (!isMessageEditable(message)) {
      showToast(REACTION_EXPIRED_MESSAGE);
      return;
    }
    const roomId = selectedRoomId;
    const myMembershipId = member.membershipId;
    const mine = (message.reactions ?? []).find((reaction) => reaction.reactedByMe);
    const reacted = mine?.emoji === emoji;
    // 1인 1개 규칙: 같은 이모지면 취소, 다른 이모지를 눌렀는데 이미 누른 게 있으면 그걸 빼고 새 것을 넣음.
    const changes: { emoji: string; action: "added" | "removed" }[] = reacted
      ? [{ emoji, action: "removed" }]
      : [
          ...(mine ? [{ emoji: mine.emoji, action: "removed" as const }] : []),
          { emoji, action: "added" as const },
        ];
    const applyChanges = (list: typeof changes) =>
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                reactions: list.reduce(
                  (reactions, change) =>
                    applyReactionChange(
                      reactions,
                      { ...change, membershipId: myMembershipId },
                      myMembershipId,
                    ),
                  item.reactions ?? [],
                ),
              }
            : item,
        ),
      );
    applyChanges(changes);
    try {
      const reactions = reacted
        ? await chatApi.removeReaction(accessToken, roomId, message.id, emoji)
        : await chatApi.addReaction(accessToken, roomId, message.id, emoji);
      setMessages((current) =>
        current.map((item) => (item.id === message.id ? { ...item, reactions } : item)),
      );
    } catch (error) {
      // 되돌리기: 낙관적으로 적용한 변화를 역순으로 반대 동작으로 적용.
      applyChanges(
        [...changes].reverse().map((change) => ({
          ...change,
          action: change.action === "added" ? "removed" : "added",
        })),
      );
      showToast(error instanceof Error ? error.message : "리액션을 반영하지 못했습니다.");
    }
  };

  const openReactionMembers = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId) return;
    try {
      const members = await chatApi.reactionMembers(accessToken, selectedRoomId, message.id);
      setReactionModal({ message, members });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "리액션 멤버를 조회하지 못했습니다.");
    }
  };

  const closeRoomManageModal = useCallback(() => setRoomManageOpen(false), []);

  const loadNewerMessages = useCallback(
    async (roomId: number, cursor: number) => {
      if (!accessToken || loadingNewerRef.current) return;
      const windowVersion = messageWindowVersionRef.current;
      loadingNewerRef.current = true;
      setIsLoadingNewerMessages(true);
      try {
        const page = await chatApi.newerMessages(accessToken, roomId, cursor);
        if (
          selectedRoomIdRef.current !== roomId ||
          messageWindowVersionRef.current !== windowVersion
        )
          return;
        newerCursorRef.current = page.newerCursor;
        setNewerCursor(page.newerCursor);
        // 실시간 도착과 다음 페이지 조회가 겹칠 수 있어 ID로 합치고 정렬.
        setMessages((current) =>
          withReadCounts(
            [
              ...new Map([...current, ...page.messages].map((item) => [item.id, item])).values(),
            ].sort((left, right) => left.id - right.id),
          ),
        );
      } catch (error) {
        showToast(error instanceof Error ? error.message : "다음 메시지를 불러오지 못했습니다.");
      } finally {
        loadingNewerRef.current = false;
        setIsLoadingNewerMessages(false);
      }
    },
    [accessToken, showToast, withReadCounts],
  );

  useEffect(() => {
    const messageList = messageListRef.current;
    if (
      !messageList ||
      !selectedRoomId ||
      newerCursor === null ||
      isLoadingNewerMessages ||
      isLocatingOriginal
    )
      return;
    // 원문 주변 대화가 화면보다 짧으면 사용자가 스크롤할 수 없으므로 다음 페이지를 자동 보충.
    if (messageList.scrollHeight <= messageList.clientHeight + 24) {
      void loadNewerMessages(selectedRoomId, newerCursor);
    }
  }, [
    messages,
    selectedRoomId,
    newerCursor,
    isLoadingNewerMessages,
    isLocatingOriginal,
    loadNewerMessages,
  ]);

  const showScrollDate = (event: React.UIEvent<HTMLDivElement>) => {
    const messageList = event.currentTarget;
    // 원문으로 부드럽게 이동하는 도중에는 스크롤 페이지 요청을 잠시 중지.
    if (
      pendingMessageScrollRef.current !== null ||
      Date.now() < originalNavigationUntilRef.current ||
      isLocatingOriginal
    )
      return;
    // 최상단 도달 시 이전 페이지를 자동으로 이어 붙임.
    if (messageList.scrollTop <= 24 && nextCursor && selectedRoomId) {
      void loadMessages(selectedRoomId, nextCursor).catch((error: Error) =>
        showToast(error.message),
      );
    }
    const reachedWindowBottom =
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <= 24;
    if (reachedWindowBottom && newerCursorRef.current !== null && selectedRoomId) {
      void loadNewerMessages(selectedRoomId, newerCursorRef.current);
    }
    const isAtBottom = reachedWindowBottom && newerCursorRef.current === null;
    isMessageListAtBottomRef.current = isAtBottom;
    setIsMessageListAtBottom(isAtBottom);
    if (isAtBottom) {
      setUnseenMessageCount(0);
      setLatestUnseenMessage(null);
    }
    const messageElements = Array.from(
      messageList.querySelectorAll<HTMLElement>("[data-message-date]"),
    );
    const visibleMessage = messageElements.find(
      (element) => element.offsetTop + element.offsetHeight > messageList.scrollTop + 8,
    );
    const nextDateKey = visibleMessage?.dataset.messageDate;
    if (!nextDateKey) return;
    // 같은 날짜 구간의 스크롤은 상태를 갱신하지 않아 전체 목록 재렌더링을 방지.
    if (activeDateKeyRef.current === nextDateKey) return;
    activeDateKeyRef.current = nextDateKey;
    showDateChip(visibleMessage?.dataset.messageLabel ?? "");
  };

  const scrollToLatestMessage = () => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    if (newerCursorRef.current !== null && selectedRoomId) {
      messageWindowVersionRef.current += 1;
      pendingMessageScrollRef.current = null;
      preservedScrollRef.current = null;
      shouldScrollToLatestRef.current = true;
      setIsLocatingOriginal(false);
      setUnseenMessageCount(0);
      setLatestUnseenMessage(null);
      void loadMessages(selectedRoomId).catch((error: Error) => showToast(error.message));
      return;
    }
    isMessageListAtBottomRef.current = true;
    setIsMessageListAtBottom(true);
    setUnseenMessageCount(0);
    setLatestUnseenMessage(null);
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
  };

  useEffect(
    () => () => {
      if (scrollDateFadeTimerRef.current) clearTimeout(scrollDateFadeTimerRef.current);
      if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const closeSortMenu = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node))
        setSortMenuOpen(false);
    };
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", closeSortMenu);
    document.addEventListener("keydown", closeByEscape);
    return () => {
      document.removeEventListener("mousedown", closeSortMenu);
      document.removeEventListener("keydown", closeByEscape);
    };
  }, []);

  // 메시지 목록은 memo로 분리돼 있어, 입력칸 타이핑 등 다른 state 변화에 다시 그려지지 않음.
  // 그러려면 넘기는 함수들의 참조가 고정돼야 하므로 여기서 한 번 감쌈.
  const stableOpenReadMembers = useStableCallback(openReadMembers);
  const stableCopyMessage = useStableCallback((target: ChatMessage) => void copyMessage(target));
  const stableStartReply = useStableCallback(startReply);
  const stableStartEdit = useStableCallback(startEdit);
  const stableStartDelete = useStableCallback(startDelete);
  const stableJumpToOriginal = useStableCallback(
    (messageId: number) => void jumpToOriginal(messageId),
  );
  const stableToggleReaction = useStableCallback(
    (message: ChatMessage, emoji: string) => void toggleReaction(message, emoji),
  );
  const stableOpenReactionMembers = useStableCallback(
    (message: ChatMessage) => void openReactionMembers(message),
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {member && (
        <GlobalHeader
          role={member.role}
          pageTitle="메시지"
          isAuthenticated
          profileName={member.displayName}
          profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`}
          isProfileMenuOpen={isProfileOpen}
          onHomeAction={() => router.push("/home")}
          onServiceAction={(label) =>
            label === "주소록" || label === "조직도"
              ? router.push("/addressBook")
              : label === "메시지"
                ? router.push("/message")
                : showToast(`${label} 기능은 준비 중입니다.`)
          }
          onProfileAction={() => setIsProfileOpen((open) => !open)}
          onCloseProfileMenu={() => setIsProfileOpen(false)}
          onLogout={() => {
            if (lastRoomStorageKey) window.sessionStorage.removeItem(lastRoomStorageKey);
            void logout().then(() => router.replace("/"));
          }}
          onSidebarToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
          headerContent={
            <label className="flex h-10 w-full max-w-[500px] items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-500">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="채팅방, 대화 상대 검색"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          }
        />
      )}
      <main className="flex h-[calc(100vh-3.5rem)] min-h-[620px]">
        <aside
          className={`relative z-50 flex shrink-0 flex-col overflow-visible border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ${isSidebarCollapsed ? "w-20" : "w-[360px]"}`}
        >
          <button
            onClick={() => setNewRoomModalOpen(true)}
            className={`m-3 h-11 cursor-pointer rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[.98] ${isSidebarCollapsed ? "text-xl" : ""}`}
          >
            {isSidebarCollapsed ? "+" : "새로 만들기"}
          </button>
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between px-5 pb-2">
              <p className="text-sm font-bold">메시지방</p>
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="메시지방 정렬"
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((open) => !open)}
                  className="flex cursor-pointer items-center gap-0.5 rounded p-1 text-slate-700 transition hover:bg-slate-200"
                >
                  <ArrowDownUp size={18} />
                  <ChevronDown
                    className={`transition-transform ${sortMenuOpen ? "rotate-180" : ""}`}
                    size={14}
                  />
                </button>
                {sortMenuOpen && (
                  <div className="absolute right-0 z-40 mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                    {(
                      [
                        { value: "TYPE", label: "종류순" },
                        { value: "LATEST", label: "시간순" },
                        { value: "UNREAD", label: "안 읽은 메시지 순" },
                      ] as { value: RoomSort; label: string }[]
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRoomSort(option.value);
                          setSortMenuOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-blue-50 ${roomSort === option.value ? "font-bold text-blue-600" : "text-slate-700"}`}
                      >
                        <span className="flex w-4 justify-center">
                          {roomSort === option.value && <Check size={16} strokeWidth={3} />}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {roomSort === "TYPE" && !isSidebarCollapsed ? (
              <>
                {groupRooms.length > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setGroupCategoryOpen((open) => !open)}
                      className="flex w-full cursor-pointer items-center gap-1 px-5 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      <ChevronDown
                        className={`transition-transform ${groupCategoryOpen ? "" : "-rotate-90"}`}
                        size={14}
                      />
                      조직/그룹
                    </button>
                    {groupCategoryOpen && groupRooms.map(renderRoomItem)}
                  </section>
                )}
                {generalRooms.length > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setGeneralCategoryOpen((open) => !open)}
                      className="flex w-full cursor-pointer items-center gap-1 px-5 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      <ChevronDown
                        className={`transition-transform ${generalCategoryOpen ? "" : "-rotate-90"}`}
                        size={14}
                      />
                      일반
                    </button>
                    {generalCategoryOpen && generalRooms.map(renderRoomItem)}
                  </section>
                )}
              </>
            ) : (
              filteredRooms.map(renderRoomItem)
            )}
            {!isSidebarCollapsed && filteredRooms.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">표시할 메시지방이 없습니다.</p>
            )}
          </div>
          {hideSelectionMode && !isSidebarCollapsed && (
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
              <button
                type="button"
                disabled={hiddenRoomIds.size === 0}
                onClick={() => setHideConfirmOpen(true)}
                className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                숨김 ({hiddenRoomIds.size})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHideSelectionMode(false);
                  setHiddenRoomIds(new Set());
                }}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          )}
        </aside>
        <section className={`min-w-0 flex-1 flex-col ${selectedRoom ? "flex" : "hidden"}`}>
          <header className="border-b border-slate-200 px-6">
            <div className="flex h-20 items-center justify-between">
              {selectedRoom?.type === "GROUP" ? (
                <button
                  type="button"
                  aria-expanded={roomManageOpen}
                  aria-label="그룹 메시지 상세 열기"
                  onClick={() => setRoomManageOpen((open) => !open)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-slate-50 active:scale-[.99]"
                >
                  <GroupAvatar name={displayRoomName(selectedRoom)} size="lg" />
                  <div>
                    <h1 className="font-bold">{displayRoomName(selectedRoom)}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                      멤버{" "}
                      <span className="text-base font-extrabold text-blue-600">
                        {selectedRoom.memberCount}
                      </span>
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <MessageMemberAvatar
                    name={headerProfile?.displayName ?? ""}
                    presenceStatus={
                      selectedRoom?.type === "SELF"
                        ? "ONLINE"
                        : (addressBookProfile?.presenceStatus ?? "OFFLINE")
                    }
                    size="lg"
                    onClick={
                      headerMembershipId ? () => openUserProfile(headerMembershipId) : undefined
                    }
                  />
                  <div>
                    <h1 className="font-bold">
                      {selectedRoom?.type === "SELF" && (
                        <span className="mr-1 rounded bg-slate-700 px-1 py-0.5 text-[10px] text-white">
                          나
                        </span>
                      )}
                      {headerProfile?.displayName ?? "메시지"}
                    </h1>
                    <p className="mt-1 text-xs">
                      <span className="text-blue-600">{headerProfile?.jobGradeName}</span>
                      <span className="text-slate-500">
                        {headerProfile?.departmentName && ` · ${headerProfile.departmentName}`}
                        {headerProfile?.companyName && ` · ${headerProfile.companyName}`}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1 flex-col">
              {scrollDateLabel && (
                <div
                  className={`pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm transition-all duration-300 ${scrollDatePhase === "visible" ? "animate-in fade-in zoom-in-95 opacity-100" : "scale-95 opacity-0"}`}
                >
                  {scrollDateLabel}
                </div>
              )}
              {(isLoadingPreviousMessages || isLoadingNewerMessages || isLocatingOriginal) && (
                <LoadingInline
                  message={
                    isLocatingOriginal
                      ? "원문 메시지로 이동 중입니다."
                      : isLoadingNewerMessages
                        ? "다음 메시지를 불러오는 중입니다."
                        : "이전 메시지를 불러오는 중입니다."
                  }
                  className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm animate-in fade-in slide-in-from-top-1"
                />
              )}
              <div
                ref={messageListRef}
                onScroll={showScrollDate}
                className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
              >
                {/* 처음 불러오는 동안과 메시지가 하나도 없을 때의 안내. */}
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    {isLoadingMessages ? (
                      <LoadingState message="메시지를 불러오는 중입니다..." />
                    ) : (
                      <>
                        <MessageCircle size={28} className="text-slate-300" aria-hidden="true" />
                        <p>아직 주고받은 메시지가 없습니다.</p>
                        <p className="text-xs text-slate-400">
                          아래 입력칸에서 첫 메시지를 보내 보세요.
                        </p>
                      </>
                    )}
                  </div>
                )}
                <MessageList
                  messages={messages}
                  highlightedMessageId={highlightedMessageId}
                  myMembershipId={member?.membershipId ?? null}
                  roomType={selectedRoom?.type ?? null}
                  contactMemberById={contactMemberById}
                  onOpenReadMembers={stableOpenReadMembers}
                  onProfileClick={openUserProfile}
                  onCopy={stableCopyMessage}
                  onReply={stableStartReply}
                  onEdit={stableStartEdit}
                  onDelete={stableStartDelete}
                  onOpenOriginal={stableJumpToOriginal}
                  onToggleReaction={stableToggleReaction}
                  onOpenReactionMembers={stableOpenReactionMembers}
                />
                {newerCursor === null && typingMembers.length > 0 && (
                  <TypingBubble
                    member={typingMembers[0]}
                    additionalCount={typingMembers.length - 1}
                    isGroup={selectedRoom?.type === "GROUP"}
                    senderProfile={contactMemberById.get(typingMembers[0].membershipId)}
                    leaving={typingBubbleLeaving}
                    onProfileClick={openUserProfile}
                  />
                )}
              </div>
              {unseenMessageCount > 0 && latestUnseenMessage && (
                <button
                  type="button"
                  onClick={scrollToLatestMessage}
                  title="새 메시지 위치로 이동"
                  // composerHeight에는 입력창 위 마진(12px)이 포함돼 있어, 8을 빼면 입력창과 4px 간격으로 맞닿음.
                  style={{ bottom: composerHeight - 8 }}
                  className="absolute left-4 right-4 z-30 flex h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-black/85 px-5 text-left text-sm text-white shadow-md backdrop-blur-sm transition duration-200 hover:bg-black/90 active:scale-[0.995]"
                >
                  <strong className="shrink-0 font-semibold">
                    {latestUnseenMessage.senderName}
                  </strong>
                  <span className="shrink-0 text-slate-300">:</span>
                  {/* 한 줄만 표시하고 줄바꿈·긴 내용은 말줄임으로 정리. */}
                  <span className="min-w-0 truncate text-slate-100">
                    {latestUnseenMessage.content.replace(/\s+/g, " ")}
                  </span>
                  <ChevronDown size={17} className="ml-auto shrink-0" aria-hidden="true" />
                </button>
              )}
              {(!isMessageListAtBottom || newerCursor !== null) && (
                <button
                  type="button"
                  aria-label="최하단 메시지로 이동"
                  onClick={scrollToLatestMessage}
                  style={{ bottom: composerHeight + 6 }}
                  className="scroll-to-bottom-button absolute right-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white/50 text-slate-600 shadow-sm backdrop-blur-sm transition duration-200 hover:bg-white/80 hover:text-blue-600 active:scale-95"
                >
                  <ArrowDown
                    size={18}
                    strokeWidth={2}
                    className="scroll-to-bottom-arrow"
                    aria-hidden="true"
                  />
                </button>
              )}
              <form
                ref={composerRef}
                onSubmit={submitMessage}
                className="relative mx-4 my-3 rounded-2xl bg-slate-100 pb-4"
              >
                {/* 입력창 위쪽 손잡이를 위아래로 끌거나 방향키로 높이 조절, 더블클릭하면 기본 높이로 복원. */}
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="메시지 입력창 높이 조절"
                  aria-valuemin={MIN_INPUT_HEIGHT}
                  aria-valuemax={MAX_INPUT_HEIGHT}
                  aria-valuenow={inputHeight}
                  tabIndex={0}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    inputResizeRef.current = { startY: event.clientY, startHeight: inputHeight };
                  }}
                  onPointerMove={(event) => {
                    const drag = inputResizeRef.current;
                    if (drag) resizeInput(drag.startHeight + drag.startY - event.clientY);
                  }}
                  onPointerUp={() => {
                    if (!inputResizeRef.current) return;
                    inputResizeRef.current = null;
                    saveInputHeight(inputHeight);
                  }}
                  onDoubleClick={() => {
                    resizeInput(DEFAULT_INPUT_HEIGHT);
                    saveInputHeight(DEFAULT_INPUT_HEIGHT);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    event.preventDefault();
                    const next = clampInputHeight(
                      inputHeight + (event.key === "ArrowUp" ? 16 : -16),
                    );
                    resizeInput(next);
                    saveInputHeight(next);
                  }}
                  className="group absolute inset-x-6 -top-2.5 z-10 flex h-5 cursor-row-resize touch-none items-center justify-center outline-none"
                >
                  <span className="h-1 w-10 rounded-full bg-slate-300 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-visible:bg-blue-500 group-focus-visible:opacity-100 group-active:bg-blue-500 group-active:opacity-100" />
                </div>
                {replyTarget && (
                  <div className="message-action-menu flex items-center gap-3 rounded-t-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                      {/* 수정 바와 같은 자리에 같은 모양의 제목 딱지. */}
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Reply size={12} aria-hidden="true" />
                        메시지 답장
                      </p>
                      <MessageQuote
                        reply={{
                          messageId: replyTarget.id,
                          senderName: replyTarget.senderName,
                          content: replyTarget.content,
                        }}
                        avatar={
                          <MessageMemberAvatar
                            name={replyTarget.senderName}
                            presenceStatus={
                              contactMemberById.get(replyTarget.senderMembershipId)
                                ?.presenceStatus ??
                              (replyTarget.senderMembershipId === member?.membershipId
                                ? "ONLINE"
                                : "OFFLINE")
                            }
                            onClick={() => openUserProfile(replyTarget.senderMembershipId)}
                          />
                        }
                      />
                    </div>
                    <Tooltip label="답장 취소" placement="top">
                      <button
                        type="button"
                        aria-label="답장 취소"
                        onClick={cancelReply}
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 active:scale-90"
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                )}
                {/* 수정 중 표시: 답장 바와 같은 자리·같은 모양에 원문을 보여 주고, X로 취소. */}
                {editingTarget && (
                  <div className="message-action-menu flex items-center gap-3 rounded-t-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Pencil size={12} aria-hidden="true" />
                        메시지 수정
                      </p>
                      <MessageQuote
                        reply={{
                          messageId: editingTarget.id,
                          senderName: editingTarget.senderName,
                          content: editingTarget.content,
                        }}
                        avatar={
                          <MessageMemberAvatar
                            name={editingTarget.senderName}
                            presenceStatus="ONLINE"
                          />
                        }
                      />
                    </div>
                    <Tooltip label="수정 취소" placement="top">
                      <button
                        type="button"
                        aria-label="수정 취소"
                        onClick={cancelEdit}
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 active:scale-90"
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                )}
                <div className="relative">
                  {replyTarget && (
                    <Reply
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
                    />
                  )}
                  {editingTarget && (
                    <Pencil
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
                    />
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    maxLength={2000}
                    onChange={(event) =>
                      handleMessageInput(
                        event.target.value,
                        event.target.selectionStart ?? event.target.value.length,
                      )
                    }
                    onKeyDown={(event) => {
                      // 한글 조합 확정 Enter를 전송으로 오인하지 않음.
                      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                      if (mentionStartIndex !== null && visibleMentionCandidates.length > 0) {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          setMentionHighlightIndex(
                            (current) =>
                              (event.key === "ArrowDown"
                                ? current + 1
                                : current - 1 + visibleMentionCandidates.length) %
                              visibleMentionCandidates.length,
                          );
                          return;
                        }
                        if (event.key === "Enter" || event.key === "Tab") {
                          event.preventDefault();
                          selectMention(
                            visibleMentionCandidates[mentionHighlightIndex] ??
                              visibleMentionCandidates[0],
                          );
                          return;
                        }
                        if (event.key === "Escape") {
                          setMentionStartIndex(null);
                          return;
                        }
                      }
                      if (event.key === "Escape" && editingTarget) {
                        cancelEdit();
                        return;
                      }
                      if (event.key === "Escape" && replyTarget) {
                        cancelReply();
                        return;
                      }
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submitMessage();
                      }
                    }}
                    placeholder={
                      editingTarget
                        ? "수정할 내용을 입력해주세요. (Enter: 저장 / Esc: 취소)"
                        : "메시지를 입력해주세요. (Enter: 전송 / Shift + Enter: 줄바꿈)"
                    }
                    style={{ height: inputHeight }}
                    className={`w-full resize-none bg-transparent pr-4 pt-3 text-sm outline-none ${replyTarget || editingTarget ? "pl-10" : "pl-4"}`}
                  />
                </div>
                {mentionStartIndex !== null && visibleMentionCandidates.length > 0 && (
                  <div className="absolute bottom-[calc(100%+8px)] left-5 z-30 max-h-72 w-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {visibleMentionCandidates.map((candidate, index) => (
                      <button
                        key={candidate.membershipId}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMention(candidate)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition ${index === mentionHighlightIndex ? "bg-blue-50" : "hover:bg-slate-50"}`}
                      >
                        {candidate.membershipId === -1 ? (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm text-blue-600">
                            <AtSign size={18} />
                          </span>
                        ) : (
                          <MessageMemberAvatar
                            name={candidate.displayName}
                            presenceStatus="OFFLINE"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">
                            @{candidate.displayName}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {candidate.jobGradeName || candidate.departmentName || "구성원"}
                            {candidate.membershipId === -1
                              ? ""
                              : ` · ${candidate.departmentName ?? ""}`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 text-slate-600">
                  <button
                    type="button"
                    aria-label="첨부"
                    onClick={() => showToast("파일 첨부 기능은 준비 중입니다.")}
                    className="cursor-pointer transition hover:text-blue-600"
                  >
                    <Paperclip size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="이미지"
                    onClick={() => showToast("이미지 전송 기능은 준비 중입니다.")}
                    className="cursor-pointer transition hover:text-blue-600"
                  >
                    <ImagePlus size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="이모지"
                    onClick={() => showToast("이모지 기능은 준비 중입니다.")}
                    className="cursor-pointer transition hover:text-blue-600"
                  >
                    <SmilePlus size={19} />
                  </button>
                </div>
              </form>
            </div>
            {roomManageOpen && selectedRoom?.type === "GROUP" && accessToken && member && (
              <GroupRoomDetail
                room={selectedRoom}
                accessToken={accessToken}
                currentMemberId={member.membershipId}
                members={contactMembers}
                onClose={closeRoomManageModal}
                onProfileClick={openUserProfile}
                onReloadMessages={() => loadMessages(selectedRoom.id)}
                onAction={async (action, targetId, name) => {
                  if (action === "leave") {
                    await chatApi.leave(accessToken, selectedRoom.id);
                    if (lastRoomStorageKey) window.sessionStorage.removeItem(lastRoomStorageKey);
                    setRoomManageOpen(false);
                    setSelectedRoomId(null);
                    setMessages([]);
                    setNextCursor(null);
                    setDraftByRoomId((current) => {
                      const remainingDrafts = { ...current };
                      delete remainingDrafts[selectedRoom.id];
                      return remainingDrafts;
                    });
                    setRooms((current) => current.filter((room) => room.id !== selectedRoom.id));
                    router.replace("/message");
                    await loadRooms();
                    return;
                  }
                  if (action === "invite") {
                    await chatApi.invite(accessToken, selectedRoom.id, targetId!);
                    await loadRooms();
                    return;
                  }
                  if (action === "remove")
                    await chatApi.remove(accessToken, selectedRoom.id, targetId!);
                  else if (action === "owner")
                    await chatApi.transferOwner(accessToken, selectedRoom.id, targetId!);
                  else await chatApi.rename(accessToken, selectedRoom.id, name!);
                  setRoomManageOpen(false);
                  await loadRooms();
                }}
                showToast={showToast}
              />
            )}
          </div>
        </section>
        {/* 아직 방을 고르지 않았을 때 오른쪽 영역 안내: 목록 로딩 중 → 방 없음 → 방 선택 순으로 구분. */}
        {!selectedRoom && (
          <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500">
            {!hasLoadedRooms ? (
              <LoadingState size="md" message="메시지방을 불러오는 중입니다..." />
            ) : rooms.length === 0 ? (
              <>
                <MessageCircle size={36} className="text-slate-300" aria-hidden="true" />
                <p className="text-base font-semibold text-slate-700">아직 메시지방이 없습니다.</p>
                <p className="text-sm">새 메시지를 시작해 동료와 대화를 나눠 보세요.</p>
                <button
                  type="button"
                  onClick={() => setNewRoomModalOpen(true)}
                  className="mt-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-95"
                >
                  새 메시지 시작
                </button>
              </>
            ) : (
              <>
                <MessageCircle size={36} className="text-slate-300" aria-hidden="true" />
                <p className="text-base font-semibold text-slate-700">메시지방을 선택해 주세요.</p>
                <p className="text-sm">왼쪽 목록에서 대화를 고르면 여기에 내용이 표시됩니다.</p>
              </>
            )}
          </section>
        )}
      </main>
      {deletingMessage && (
        <MessageDeleteDialog
          key={deletingMessage.message.id}
          onClose={closeDelete}
          onDelete={deleteSelectedMessage}
          onNotice={showToast}
        />
      )}
      {hideConfirmOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHideConfirmOpen(false);
          }}
        >
          <section className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-500">
              !
            </div>
            <h2 className="text-lg font-bold">메시지 내용은 삭제하지 않습니다.</h2>
            <div className="mt-7 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHideConfirmOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 px-5 py-2.5 text-sm transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!accessToken) return;
                  void Promise.all(
                    [...hiddenRoomIds].map((roomId) => chatApi.hide(accessToken, roomId)),
                  )
                    .then(async () => {
                      setRooms((current) => current.filter((room) => !hiddenRoomIds.has(room.id)));
                      if (selectedRoomId && hiddenRoomIds.has(selectedRoomId))
                        setSelectedRoomId(null);
                      setHideConfirmOpen(false);
                      setHideSelectionMode(false);
                      setHiddenRoomIds(new Set());
                      showToast("메시지방을 숨겼습니다.");
                      await loadRooms();
                    })
                    .catch((error: Error) => showToast(error.message));
                }}
                className="cursor-pointer rounded-lg border border-red-500 px-5 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
              >
                숨김
              </button>
            </div>
          </section>
        </div>
      )}
      {notificationRoom && accessToken && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNotificationRoom(null);
          }}
        >
          <section className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">알림 설정</h2>
              <button
                type="button"
                aria-label="알림 설정 닫기"
                onClick={() => setNotificationRoom(null)}
                className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {displayRoomName(notificationRoom)}의 알림 수신 기준을 선택하세요.
            </p>
            <div className="mt-5 space-y-2">
              {(
                [
                  ["ALL", "모든 메시지 알림", "방의 모든 새 메시지를 알립니다."],
                  ["MENTION", "내가 멘션된 메시지만 알림", "@멘션된 메시지만 알립니다."],
                  ["NONE", "알림 받지 않기", "토스트와 상단 알림에서 제외합니다."],
                ] as const
              ).map(([mode, title, description]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    void chatApi
                      .updateNotification(accessToken, notificationRoom.id, mode)
                      .then(async () => {
                        setNotificationRoom(null);
                        await loadRooms();
                        showToast(`${title}으로 설정했습니다.`);
                      })
                      .catch((error: Error) => showToast(error.message));
                  }}
                  className={`w-full cursor-pointer rounded-lg border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 ${notificationRoom.notificationMode === mode ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
                >
                  <strong className="block text-sm">{title}</strong>
                  <span className="mt-1 block text-xs text-slate-500">{description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {newRoomModalOpen && accessToken && (
        <NewRoomModal
          members={contactMembers}
          initialMemberIds={requestedMemberIds}
          initialType={searchParams.get("create") === "group" ? "GROUP" : "DIRECT"}
          onClose={() => setNewRoomModalOpen(false)}
          onProfileClick={openUserProfile}
          onCreate={async (type, name, memberIds) => {
            const room =
              type === "DIRECT"
                ? await chatApi.createDirect(accessToken, memberIds[0])
                : await chatApi.createGroup(accessToken, name, memberIds);
            setSelectedRoomId(room.id);
            setNewRoomModalOpen(false);
            await loadRooms();
            router.push(`/message?roomId=${room.id}`);
          }}
          onSelf={async () => {
            const room = await chatApi.createSelf(accessToken);
            setSelectedRoomId(room.id);
            setNewRoomModalOpen(false);
            await loadRooms();
            router.push(`/message?roomId=${room.id}`);
          }}
          showToast={showToast}
        />
      )}
      {readModal && (
        <ReadMemberModal
          modal={readModal}
          contactMembers={contactMembers}
          onClose={() => setReadModal(null)}
          onProfileClick={openUserProfile}
          onTab={(read) => setReadModal((current) => current && { ...current, read })}
        />
      )}
      {reactionModal && (
        <ReactionMemberModal
          modal={reactionModal}
          contactMemberById={contactMemberById}
          onClose={() => setReactionModal(null)}
          onProfileClick={openUserProfile}
        />
      )}
      {profileMember && accessToken && (
        <UserProfileModal
          member={profileMember}
          onClose={() => setProfileMemberId(null)}
          onToggleFavorite={async () => {
            const nextFavorite = !profileMember.favorite;
            if (nextFavorite)
              await addressBookApi.createFavorite(accessToken, profileMember.membershipId);
            else await addressBookApi.deleteFavorite(accessToken, profileMember.membershipId);
            setProfileMember((current) =>
              current ? { ...current, favorite: nextFavorite } : current,
            );
            setContactMembers((current) =>
              current.map((contact) =>
                contact.membershipId === profileMember.membershipId
                  ? { ...contact, favorite: nextFavorite }
                  : contact,
              ),
            );
            showToast(nextFavorite ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.");
          }}
          onMessage={async () => {
            const room =
              profileMember.membershipId === member?.membershipId
                ? await chatApi.createSelf(accessToken)
                : await chatApi.createDirect(accessToken, profileMember.membershipId);
            setProfileMemberId(null);
            setSelectedRoomId(room.id);
            await loadRooms();
            router.push(`/message?roomId=${room.id}`);
          }}
          showToast={showToast}
        />
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}

// 방 항목은 memo로 묶어, 메시지 입력·수신 등으로 부모가 다시 그려져도 자기 props가 같으면 건너뜀.
// 그래서 콜백은 방마다 새 함수를 만들지 않고, 어느 방인지를 인자로 받는 고정 함수를 사용.
const MessageRoomItem = memo(function MessageRoomItem({
  room,
  currentMember,
  contactMemberById,
  isSelected,
  typingPreviewLabel,
  isCollapsed,
  onSelect,
  onProfileClick,
  menuOpen,
  hideSelectionMode,
  hiddenSelected,
  onToggleMenu,
  onToggleHidden,
  onAction,
}: {
  room: ChatRoom;
  currentMember: { membershipId: number; displayName: string } | null;
  contactMemberById: Map<number, AddressBookMember>;
  isSelected: boolean;
  typingPreviewLabel: string | null;
  isCollapsed: boolean;
  onSelect: (roomId: number) => void;
  onProfileClick: (membershipId: number) => void;
  menuOpen: boolean;
  hideSelectionMode: boolean;
  hiddenSelected: boolean;
  onToggleMenu: (roomId: number) => void;
  onToggleHidden: (roomId: number) => void;
  onAction: (room: ChatRoom, action: "notification" | "pin" | "hide" | "leave") => void;
}) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  // 1:1 방은 상대방, 나와의 채팅은 본인 프로필을 목록에 표시.
  const isSelf = room.type === "SELF";
  const isDirect = room.type === "DIRECT";
  const displayName = isSelf
    ? (currentMember?.displayName ?? "나")
    : isDirect
      ? (room.directDisplayName ?? "사용자")
      : (room.name ?? "그룹 메시지");
  const avatarName = isSelf
    ? (currentMember?.displayName ?? "나")
    : isDirect
      ? (room.directDisplayName ?? "사용자")
      : (room.name ?? "그룹");
  const isTypingPreview = Boolean(typingPreviewLabel);
  const lastMessage = room.lastMessage ?? "대화를 시작해 보세요.";
  // 실제 Enter 줄바꿈만 두 줄 미리보기로 취급. 단순히 긴 한 줄은 다음 줄로 넘기지 않음.
  const previewLines = lastMessage.split(/\r?\n/);
  const hasLineBreak = previewLines.length > 1;
  const secondPreview = previewLines.length > 2 ? `${previewLines[1]} …` : previewLines[1];
  const sentByMe = !isTypingPreview && room.lastSenderMembershipId === currentMember?.membershipId;
  const presenceStatus = isSelf
    ? "ONLINE"
    : (contactMemberById.get(room.directMembershipId ?? -1)?.presenceStatus ?? "OFFLINE");

  return (
    <div
      data-room-menu
      className={`group relative flex w-[calc(100%-1rem)] gap-3 rounded-lg ${isCollapsed ? "mx-2 my-1 justify-center px-2 py-3" : "mx-2 my-1 px-3 py-3"} text-left transition-colors duration-200 hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}
    >
      {hideSelectionMode && !isCollapsed && (
        <button
          type="button"
          role="checkbox"
          aria-checked={hiddenSelected}
          onClick={() => onToggleHidden(room.id)}
          className={`custom-checkbox-button mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${hiddenSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}
        >
          {hiddenSelected && <Check size={14} strokeWidth={3} />}
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={displayName}
        onClick={() => onSelect(room.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(room.id);
          }
        }}
        className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left"
      >
        <span className="relative shrink-0">
          {room.type === "GROUP" ? (
            <GroupAvatar name={avatarName} />
          ) : (
            <MessageMemberAvatar
              name={avatarName}
              presenceStatus={presenceStatus}
              onClick={() =>
                onProfileClick(isSelf ? currentMember!.membershipId : room.directMembershipId!)
              }
            />
          )}
          {room.pinned && (
            <span className="absolute -left-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-blue-100">
              <Pin size={9} fill="currentColor" strokeWidth={2.5} />
            </span>
          )}
        </span>
        {!isCollapsed && (
          <span className="min-w-0 flex-1">
            <span className="flex justify-between gap-2">
              <b className="flex min-w-0 items-center gap-1 truncate">
                {isSelf && (
                  <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[9px] text-white">
                    나
                  </span>
                )}
                <span className="truncate">{displayName}</span>
                {room.type === "GROUP" && (
                  <span className="shrink-0 text-base font-extrabold text-blue-600">
                    {room.memberCount}
                  </span>
                )}
              </b>
              {/* 시간과 메뉴를 동일한 고정 영역에 겹쳐 행 너비가 흔들리지 않게 함. */}
              <span className="static h-5 w-16 shrink-0">
                <small
                  className={`absolute right-3 top-3 whitespace-nowrap text-right leading-5 text-slate-500 transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}
                >
                  {formatRoomTime(room.lastMessageAt)}
                </small>
                <button
                  ref={menuButtonRef}
                  type="button"
                  aria-label="메시지방 메뉴"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenuPosition({ left: rect.left, top: rect.bottom + 6 });
                    onToggleMenu(room.id);
                  }}
                  className={`absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-slate-600 opacity-0 transition-opacity duration-150 hover:bg-slate-200 group-hover:pointer-events-auto group-hover:opacity-100 ${menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none"}`}
                >
                  <MoreVertical size={17} />
                </button>
              </span>
            </span>
            <span className="mt-0.5 flex items-start gap-2">
              <span className="flex min-w-0 flex-1 items-start gap-1 text-slate-600">
                {sentByMe && (
                  <Forward className="mt-0.5 shrink-0 text-slate-600" size={15} strokeWidth={3} />
                )}
                <span className="min-w-0 flex-1 text-[16px]">
                  {isTypingPreview ? (
                    <small className="flex items-center gap-1 truncate text-slate-500">
                      <span className="truncate">{typingPreviewLabel}</span>
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5"
                        aria-label="입력 중"
                      >
                        <i className="typing-dot inline-block h-1 w-1 rounded-full bg-slate-400" />
                        <i className="typing-dot typing-dot-delay-1 inline-block h-1 w-1 rounded-full bg-slate-400" />
                        <i className="typing-dot typing-dot-delay-2 inline-block h-1 w-1 rounded-full bg-slate-400" />
                      </span>
                    </small>
                  ) : (
                    <>
                      <small className="block truncate">{previewLines[0] || " "}</small>
                      {hasLineBreak && (
                        <small className="block truncate">{secondPreview || " "}</small>
                      )}
                    </>
                  )}
                </span>
              </span>
              {room.unreadCount > 0 && (
                <em
                  className={`mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-full bg-red-500 px-1.5 text-[12px] font-bold leading-none not-italic text-white transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}
                >
                  {room.lastMessageMentioned && (
                    <AtSign size={11} strokeWidth={3} aria-label="나를 멘션한 메시지" />
                  )}
                  {room.unreadCount > 999 ? "999+" : room.unreadCount}
                </em>
              )}
            </span>
          </span>
        )}
      </div>
      {menuOpen &&
        !isCollapsed &&
        menuPosition &&
        createPortal(
          <div
            data-room-menu
            className="fixed z-[200] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95"
            style={menuPosition}
          >
            <button
              type="button"
              onClick={() => onAction(room, "notification")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <Bell size={15} />
              알림 설정
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "pin")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <Pin size={15} />
              {room.pinned ? "핀 고정 해제" : "핀 고정"}
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "hide")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <EyeOff size={15} />
              숨김
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "leave")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} />
              나가기
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
});

function GroupAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-10 w-10 text-xs" : "h-10 w-10 text-xs";
  // 그룹방은 프로필 원형과 별개로 우하단 배지를 항상 표시.
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white ${sizeClass}`}
    >
      <span>{name.slice(0, 3)}</span>
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white">
        <UsersRound size={10} strokeWidth={3} />
      </span>
    </span>
  );
}

function MessageMemberAvatar({
  name,
  presenceStatus,
  size = "md",
  onClick,
}: {
  name: string;
  presenceStatus: PresenceStatus;
  size?: "md" | "lg";
  onClick?: () => void;
}) {
  const isLarge = size === "lg";
  const badgeClassName = {
    ONLINE: "bg-emerald-500",
    OFFLINE: "bg-slate-300",
    AWAY: "bg-slate-500 text-white",
    INACTIVE: "bg-red-500 text-white",
  }[presenceStatus];
  // 개인 프로필은 어느 메시지 화면에서도 상태 배지를 빠뜨리지 않음.
  const openProfile = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onClick) return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <span
      data-message-profile-name={name}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${name} 프로필 보기` : undefined}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-800 ${onClick ? "cursor-pointer transition hover:border-blue-400 hover:shadow-sm active:scale-95" : ""} ${isLarge ? "h-10 w-10 text-xs" : "h-10 w-10 text-xs"}`}
    >
      <span className="whitespace-nowrap">{name.slice(0, 3)}</span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-white ${isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} ${badgeClassName}`}
      >
        {(presenceStatus === "AWAY" || presenceStatus === "INACTIVE") && (
          <X size={isLarge ? 10 : 9} strokeWidth={3} />
        )}
      </span>
    </span>
  );
}

function MentionText({ content }: { content: string }) {
  // 저장된 본문은 그대로 두고 화면에서만 @멘션 강조와 URL 링크를 입힘(복사/검색 동작 유지).
  return (
    <>
      {tokenizeMessage(content).map((token, index) => {
        if (token.type === "mention")
          return (
            <span key={index} className="text-blue-600">
              {token.value}
            </span>
          );
        if (token.type === "url")
          return (
            <a
              key={index}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              // 말풍선의 우클릭 메뉴·드래그와 겹치지 않게 링크 클릭은 여기서 끝냄.
              onClick={(event) => event.stopPropagation()}
              className="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 hover:decoration-blue-500"
            >
              {token.value}
            </a>
          );
        return token.value;
      })}
    </>
  );
}

// 메시지 목록만 따로 memo로 묶어, 입력칸 타이핑·상대 입력 표시·접속 상태 같은 다른 state가 바뀔 때
// 말풍선 50개를 매번 다시 계산하지 않게 함. messages 배열이나 강조 ID가 바뀔 때만 다시 그려짐.
const MessageList = memo(function MessageList({
  messages,
  highlightedMessageId,
  myMembershipId,
  roomType,
  contactMemberById,
  onOpenReadMembers,
  onProfileClick,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  onOpenOriginal,
  onToggleReaction,
  onOpenReactionMembers,
}: {
  messages: ChatMessage[];
  highlightedMessageId: number | null;
  myMembershipId: number | null;
  roomType: ChatRoom["type"] | null;
  contactMemberById: Map<number, AddressBookMember>;
  onOpenReadMembers: (message: ChatMessage) => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  onCopy: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onOpenOriginal: (messageId: number) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onOpenReactionMembers: (message: ChatMessage) => void;
}) {
  return (
    <>
      {messages.map((message, index) => {
        const label = formatChatDate(message.createdAt);
        const showDate =
          index === 0 || dateKey(messages[index - 1].createdAt) !== dateKey(message.createdAt);
        const sender = contactMemberById.get(message.senderMembershipId);
        const previousMessage = messages[index - 1];
        const nextMessage = messages[index + 1];
        const isGroupedWithPrevious =
          message.type === "TEXT" &&
          previousMessage?.type === "TEXT" &&
          previousMessage.senderMembershipId === message.senderMembershipId &&
          minuteKey(previousMessage.createdAt) === minuteKey(message.createdAt);
        const isGroupedWithNext =
          message.type === "TEXT" &&
          nextMessage?.type === "TEXT" &&
          nextMessage.senderMembershipId === message.senderMembershipId &&
          minuteKey(nextMessage.createdAt) === minuteKey(message.createdAt);
        return (
          <Fragment key={message.id}>
            {showDate && (
              <p className="my-5 text-center">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {label}
                </span>
              </p>
            )}
            <div
              data-message-id={message.id}
              className="group/message relative w-full"
              data-message-date={dateKey(message.createdAt)}
              data-message-label={label}
            >
              {message.type === "SYSTEM" ? (
                <p className="my-5 text-center text-xs text-slate-400">{message.content}</p>
              ) : (
                <MessageBubble
                  message={message}
                  isOriginalHighlighted={highlightedMessageId === message.id}
                  isMine={message.senderMembershipId === myMembershipId}
                  isDirect={roomType === "DIRECT"}
                  isGroup={roomType === "GROUP"}
                  senderProfile={sender}
                  showSender={!isGroupedWithPrevious}
                  showMeta={!isGroupedWithNext}
                  showTail={!isGroupedWithPrevious}
                  onOpenReadMembers={onOpenReadMembers}
                  onProfileClick={onProfileClick}
                  onCopy={onCopy}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpenOriginal={onOpenOriginal}
                  onToggleReaction={onToggleReaction}
                  onOpenReactionMembers={onOpenReactionMembers}
                />
              )}
            </div>
          </Fragment>
        );
      })}
    </>
  );
});

// 말풍선 하나는 자기 props가 바뀔 때만 다시 그림(목록 안에서 다른 말풍선이 바뀌어도 영향 없음).
const MessageBubble = memo(function MessageBubble({
  message,
  isOriginalHighlighted,
  isMine,
  isDirect,
  isGroup,
  senderProfile,
  showSender,
  showMeta,
  showTail,
  onOpenReadMembers,
  onProfileClick,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  onOpenOriginal,
  onToggleReaction,
  onOpenReactionMembers,
}: {
  message: ChatMessage;
  isOriginalHighlighted: boolean;
  isMine: boolean;
  isDirect: boolean;
  isGroup: boolean;
  senderProfile?: AddressBookMember;
  showSender: boolean;
  showMeta: boolean;
  showTail: boolean;
  onOpenReadMembers: (message: ChatMessage) => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  onCopy: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onOpenOriginal: (messageId: number) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onOpenReactionMembers: (message: ChatMessage) => void;
}) {
  // ⋮ 클릭과 말풍선 우클릭이 같은 메뉴·닫기 동작을 공유.
  const [menuPosition, setMenuPosition] = useState<MessageMenuPosition | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!isOriginalHighlighted || !bubble) return;
    // 두 번 통통 튄 뒤 원래 자리로 복귀. 테두리 상태는 별도로 유지.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = bubble.animate(
      reducedMotion
        ? [{ opacity: 0.6 }, { opacity: 1 }]
        : [
            { transform: "translateY(0)", offset: 0 },
            { transform: "translateY(-10px)", offset: 0.25 },
            { transform: "translateY(0)", offset: 0.5 },
            { transform: "translateY(-5px)", offset: 0.75 },
            { transform: "translateY(0)", offset: 1 },
          ],
      { duration: reducedMotion ? 250 : 1150, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [isOriginalHighlighted]);
  const time = new Date(message.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  // 그룹방은 발신자와 관계없이 모든 일반 메시지의 실제 읽음 상태를 표시.
  const readLabel = message.deletedAt ? null : isMine && isDirect && message.unreadCount === 0 ? (
    <span className="mb-0.5 text-[12px] font-medium text-blue-600">읽음</span>
  ) : isGroup && message.readCount > 0 ? (
    <button
      className="mb-0.5 inline-flex cursor-pointer items-center gap-0.5 text-[12px] font-medium text-blue-600 transition hover:underline"
      onClick={() => void onOpenReadMembers(message)}
    >
      {isMine ? <ChevronLeft size={12} strokeWidth={2} /> : null}읽음 {message.readCount}
      {!isMine ? <ChevronRight size={12} strokeWidth={2} /> : null}
    </button>
  ) : null;
  // 읽음은 메시지별 상태라 매 말풍선에 표시하고, 시간만 같은 분 묶음의 마지막에 표시.
  const meta =
    readLabel || showMeta ? (
      <div
        className={`flex shrink-0 flex-col text-[12px] text-slate-400 ${isMine ? "items-end text-right" : "items-start text-left"}`}
      >
        {readLabel}
        {showMeta ? <span>{time}</span> : null}
      </div>
    ) : null;
  const reactions = message.deletedAt ? [] : (message.reactions ?? []);
  const messageMenu = message.deletedAt ? (
    <span aria-hidden="true" className="h-5 w-6 shrink-0" />
  ) : (
    <MessageActionMenu
      isMine={isMine}
      canEdit={isMessageEditable(message)}
      position={menuPosition}
      onPositionChange={setMenuPosition}
      onCopy={() => onCopy(message)}
      onReply={() => onReply(message)}
      onEdit={() => onEdit(message)}
      onDelete={() => onDelete(message)}
    />
  );
  // 시간과 ⋮ 사이의 스마일 버튼. 누르면 이모지 선택창이 뜨고, 이미 누른 게 있으면 색칠됨.
  const reactionButton = message.deletedAt ? null : (
    <ReactionPicker
      isMine={isMine}
      reactedEmojis={reactions
        .filter((reaction) => reaction.reactedByMe)
        .map((reaction) => reaction.emoji)}
      expiredMessage={isMessageEditable(message) ? null : REACTION_EXPIRED_MESSAGE}
      onReact={(emoji) => onToggleReaction(message, emoji)}
    />
  );
  // 말풍선 바로 아래 한 줄: 리액션 묶음 + "수정됨". 추가·취소는 스마일 버튼에서, 칩을 클릭하면 누른 사람 목록.
  const underBubble =
    reactions.length > 0 || message.editedAt ? (
      <div
        className={`pointer-events-none absolute top-full mt-1 flex items-center gap-1 whitespace-nowrap ${isMine ? "right-1 flex-row-reverse" : "left-1"}`}
      >
        {message.editedAt && <span className="text-xs leading-4 text-slate-500">수정됨</span>}
        {reactions.map((reaction) => (
          <Tooltip
            key={reaction.emoji}
            label={`${reactionLabel(reaction.emoji)} ${reaction.count}명 · 클릭: 누른 사람 보기`}
          >
            <button
              type="button"
              aria-label={`${reactionLabel(reaction.emoji)} ${reaction.count}명${reaction.reactedByMe ? ", 내가 누름" : ""}. 누른 사람 보기`}
              onClick={() => onOpenReactionMembers(message)}
              className={`pointer-events-auto flex h-7 cursor-pointer items-center gap-0.5 rounded px-1 text-[15px] transition hover:bg-slate-100 active:scale-95 ${reaction.reactedByMe ? "font-bold" : "font-medium"}`}
            >
              <ReactionEmoji code={reaction.emoji} size={20} />
              <span className="tabular-nums text-blue-600">{reaction.count}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    ) : null;
  // 시간과 메뉴의 밑선을 맞추고, 메뉴가 숨겨져도 공간을 유지해 말풍선 흔들림 방지.
  const messageActions = (
    <div className="flex shrink-0 items-end gap-1 pb-1">
      {isMine ? (
        <>
          {messageMenu}
          {reactionButton}
          {meta}
        </>
      ) : (
        <>
          {meta}
          {reactionButton}
          {messageMenu}
        </>
      )}
    </div>
  );
  // 꼬리는 프로필 쪽을 향하는 위쪽 대각선의 직각삼각형으로 표현.
  const reply = message.deletedAt ? null : message.reply;
  // 말풍선 아래 줄(리액션·수정됨)이 있으면 그 높이만큼 아래 여백을 늘려 다음 메시지와 겹치지 않게 처리.
  const rowSpacing =
    reactions.length > 0 ? "mb-10" : message.editedAt ? "mb-7" : showMeta ? "mb-2" : "mb-1";
  const bubble = (
    <div
      ref={bubbleRef}
      data-message-bubble
      onContextMenu={(event) => {
        // 브라우저 기본 메뉴를 막고 커서 위치에 메시지 메뉴를 표시.
        event.preventDefault();
        event.stopPropagation();
        if (message.deletedAt) return;
        setMenuPosition({
          left: Math.max(8, Math.min(event.clientX, window.innerWidth - 152)),
          top: Math.max(8, Math.min(event.clientY, window.innerHeight - (isMine ? 184 : 100))),
        });
      }}
      className={`relative min-w-0 ${isGroup && !isMine ? "max-w-full" : "max-w-[70%]"} whitespace-pre-wrap break-words ${reply ? "w-[380px]" : "px-4 py-3"} text-sm leading-6 ${isMine ? "rounded-2xl bg-blue-100" : "rounded-2xl bg-slate-100"} ${showTail ? (isMine ? "after:absolute after:-right-2 after:top-3 after:h-3 after:w-3 after:bg-blue-100 after:[clip-path:polygon(0_0,0_100%,100%_0)]" : "after:absolute after:-left-2 after:top-3 after:h-3 after:w-3 after:bg-slate-100 after:[clip-path:polygon(100%_0,100%_100%,0_0)]") : ""}`}
    >
      {/* 꼬리 가상 요소보다 앞에 테두리를 그려 접점에서도 파란 선이 가려지지 않게 처리. */}
      {isOriginalHighlighted && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            borderRadius: "inherit",
            outline: "2px solid #3b82f6",
            outlineOffset: "0px",
          }}
        />
      )}
      {reply && <MessageQuote reply={reply} onOpen={() => onOpenOriginal(reply.messageId)} />}
      {reply ? (
        <div className="px-3 py-2">
          <MentionText content={message.content} />
          {underBubble}
        </div>
      ) : message.deletedAt ? (
        <span className="text-slate-400 italic">{message.content}</span>
      ) : (
        <>
          <MentionText content={message.content} />
          {underBubble}
        </>
      )}
    </div>
  );
  if (!isMine && isGroup) {
    // 그룹방 제3자 메시지는 프로필을 기준으로 말풍선 꼬리가 왼쪽을 향하게 배치.
    return (
      <div className={`${rowSpacing} flex items-start gap-2`}>
        {showSender ? (
          <span className="mt-3 w-10 shrink-0">
            <MessageMemberAvatar
              name={senderProfile?.displayName ?? message.senderName}
              presenceStatus={senderProfile?.presenceStatus ?? "OFFLINE"}
              onClick={() => onProfileClick(message.senderMembershipId)}
            />
          </span>
        ) : (
          <span className="w-10 shrink-0" />
        )}
        <div className="min-w-0 max-w-[70%]">
          {showSender && (
            <button
              type="button"
              onClick={() => onProfileClick(message.senderMembershipId)}
              className="mt-3 cursor-pointer text-left text-sm font-bold transition hover:text-blue-600"
            >
              {senderProfile?.displayName ?? message.senderName}
            </button>
          )}
          <div className={`${showSender ? "mt-1" : ""} flex items-end gap-2`}>
            {bubble}
            {messageActions}
          </div>
        </div>
      </div>
    );
  }
  // 내 말풍선은 시간→말풍선, 상대 말풍선은 말풍선→시간 순서.
  return (
    <div className={`${rowSpacing} ${isMine ? "ml-auto" : "mr-auto"} max-w-[85%]`}>
      <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
        {isMine ? (
          <>
            {messageActions}
            {bubble}
          </>
        ) : (
          <>
            {bubble}
            {messageActions}
          </>
        )}
      </div>
    </div>
  );
});

// 메시지에 리액션한 사람 목록(네이버웍스식). 위에 이모지별 집계 칩, 아래 테두리 박스 안에 사람 목록.
// 접속 상태는 주소록 초기값에 실시간 프레즌스를 합친 contactMemberById를 읽어 읽은 멤버 모달과 같은 기준을 씀.
function ReactionMemberModal({
  modal,
  contactMemberById,
  onClose,
  onProfileClick,
}: {
  modal: ReactionModalState;
  contactMemberById: Map<number, AddressBookMember>;
  onClose: () => void;
  onProfileClick: (membershipId: number) => void;
}) {
  // 칩을 누르면 그 이모지를 고른 사람만 보여 주고, 다시 누르면 전체로 돌아감.
  const [filterEmoji, setFilterEmoji] = useState<string | null>(null);
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    modal.members.forEach(({ emoji }) => counts.set(emoji, (counts.get(emoji) ?? 0) + 1));
    return [...counts.entries()].map(([emoji, count]) => ({ emoji, count }));
  }, [modal.members]);
  const visibleMembers = filterEmoji
    ? modal.members.filter(({ emoji }) => emoji === filterEmoji)
    : modal.members;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="리액션 멤버"
        className="message-action-menu flex h-[min(680px,calc(100vh-2rem))] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">리액션 ({modal.members.length})</h2>
          <button
            type="button"
            aria-label="리액션 닫기"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-1">
          {summary.map(({ emoji, count }) => {
            const selected = filterEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={selected}
                aria-label={`${reactionLabel(emoji)} ${count}명${selected ? ", 선택됨" : ""}`}
                onClick={() => setFilterEmoji(selected ? null : emoji)}
                className={`flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-sm transition hover:bg-slate-100 active:scale-95 ${selected ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600"}`}
              >
                <ReactionEmoji code={emoji} size={20} />
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {visibleMembers.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              아직 아무도 누르지 않았습니다.
            </p>
          ) : (
            visibleMembers.map(({ emoji, member }) => (
              <button
                type="button"
                key={member.membershipId}
                onClick={() => onProfileClick(member.membershipId)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100"
              >
                <MessageMemberAvatar
                  name={member.displayName}
                  presenceStatus={
                    contactMemberById.get(member.membershipId)?.presenceStatus ?? "OFFLINE"
                  }
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-slate-900">{member.displayName}</b>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {member.jobGradeName && (
                      <span className="text-blue-600">{member.jobGradeName}</span>
                    )}
                    {member.jobGradeName && member.departmentName && "/"}
                    {member.departmentName}
                  </span>
                </span>
                <ReactionEmoji code={emoji} size={24} />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// 실제 수신 말풍선과 같은 구조로 입력 중 상태만 표시.
function TypingBubble({
  member,
  additionalCount,
  isGroup,
  senderProfile,
  leaving,
  onProfileClick,
}: {
  member: { membershipId: number; displayName: string };
  additionalCount: number;
  isGroup: boolean;
  senderProfile?: AddressBookMember;
  leaving: boolean;
  onProfileClick: (membershipId: number) => void;
}) {
  const label =
    isGroup && additionalCount > 0
      ? `${member.displayName} 외 ${additionalCount}명이 입력 중입니다`
      : `${member.displayName}님이 입력 중입니다`;
  const bubble = (
    <div className="relative inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-400 after:absolute after:-left-2 after:top-3 after:h-3 after:w-3 after:bg-slate-100 after:[clip-path:polygon(100%_0,100%_100%,0_0)]">
      <span>{label}</span>
      <span className="inline-flex items-center gap-0.5" aria-label="입력 중">
        <i className="typing-dot inline-block h-1 w-1 rounded-full bg-slate-400" />
        <i className="typing-dot typing-dot-delay-1 inline-block h-1 w-1 rounded-full bg-slate-400" />
        <i className="typing-dot typing-dot-delay-2 inline-block h-1 w-1 rounded-full bg-slate-400" />
      </span>
    </div>
  );

  if (!isGroup) {
    return (
      <div
        className={`typing-bubble ${leaving ? "typing-bubble-exit" : "typing-bubble-enter"} mb-4 mr-auto max-w-[85%]`}
      >
        {bubble}
      </div>
    );
  }

  return (
    <div
      className={`typing-bubble ${leaving ? "typing-bubble-exit" : "typing-bubble-enter"} mb-4 flex items-start gap-2`}
    >
      <MessageMemberAvatar
        name={senderProfile?.displayName ?? member.displayName}
        presenceStatus={senderProfile?.presenceStatus ?? "OFFLINE"}
        onClick={() => onProfileClick(member.membershipId)}
      />
      <div className="w-fit max-w-[70%]">
        <button
          type="button"
          onClick={() => onProfileClick(member.membershipId)}
          className="cursor-pointer text-left text-sm font-bold transition hover:text-blue-600"
        >
          {senderProfile?.displayName ?? member.displayName}
        </button>
        <div className="mt-1 flex items-end gap-2">{bubble}</div>
      </div>
    </div>
  );
}

function NewRoomModal({
  members,
  initialMemberIds,
  initialType,
  onClose,
  onCreate,
  onSelf,
  onProfileClick,
  showToast,
}: {
  members: AddressBookMember[];
  initialMemberIds: number[];
  initialType: "DIRECT" | "GROUP";
  onClose: () => void;
  onCreate: (type: "DIRECT" | "GROUP", name: string, memberIds: number[]) => Promise<void>;
  onSelf: () => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  showToast: (message: string) => void;
}) {
  const [type, setType] = useState<"DIRECT" | "GROUP">(initialType);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(initialMemberIds);
  const [keyword, setKeyword] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (event.target === ref.current) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const visibleMembers = members.filter((member) =>
    `${member.displayName} ${member.email} ${member.companyName} ${member.departmentName ?? ""} ${member.jobGradeName ?? ""}`
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );
  const toggleMember = (membershipId: number) =>
    setSelectedIds((current) =>
      type === "DIRECT"
        ? [membershipId]
        : current.includes(membershipId)
          ? current.filter((id) => id !== membershipId)
          : [...current, membershipId],
    );
  const submit = async () => {
    if (type === "DIRECT" && selectedIds.length !== 1) {
      showToast("1:1 메시지 상대를 한 명 선택해 주세요.");
      return;
    }
    if (type === "GROUP" && !name.trim()) {
      showToast("그룹명을 입력해 주세요.");
      return;
    }
    if (type === "GROUP" && selectedIds.length < 2) {
      showToast("그룹 메시지는 나를 포함해 3명 이상이어야 합니다.");
      return;
    }
    try {
      await onCreate(type, name.trim(), selectedIds);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지방을 만들지 못했습니다.");
    }
  };
  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <section className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">새 메시지</h2>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="cursor-pointer p-1 text-slate-500 hover:text-slate-900"
          >
            <X />
          </button>
        </div>
        <button
          onClick={() => void onSelf()}
          className="mt-4 w-full cursor-pointer rounded-lg border border-slate-200 py-2 text-sm transition hover:bg-slate-50"
        >
          나와의 채팅
        </button>
        <div className="mt-5 flex border-b border-slate-200">
          <button
            onClick={() => {
              setType("DIRECT");
              setSelectedIds([]);
            }}
            className={`cursor-pointer px-4 py-2 text-sm ${type === "DIRECT" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-500"}`}
          >
            1:1 메시지
          </button>
          <button
            onClick={() => {
              setType("GROUP");
              setSelectedIds([]);
            }}
            className={`cursor-pointer px-4 py-2 text-sm ${type === "GROUP" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-500"}`}
          >
            그룹 메시지
          </button>
        </div>
        {type === "GROUP" && (
          <label className="mt-4 block text-sm font-medium">
            그룹명
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"
              placeholder="그룹명을 입력하세요"
            />
          </label>
        )}
        <label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
          <Search size={17} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="w-full text-sm outline-none"
            placeholder="구성원 검색"
          />
        </label>
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          {visibleMembers.map((member) => {
            const selected = selectedIds.includes(member.membershipId);
            return (
              <button
                key={member.membershipId}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggleMember(member.membershipId)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${selected ? "bg-blue-50" : ""}`}
              >
                <MessageMemberAvatar
                  name={member.displayName}
                  presenceStatus={member.presenceStatus}
                  onClick={() => onProfileClick(member.membershipId)}
                />
                <span className="min-w-0 flex-1">
                  <b className="block text-sm">{member.displayName}</b>
                  <small className="block truncate text-slate-500">
                    {[
                      member.companyName,
                      member.departmentName ?? "부서 미지정",
                      member.jobGradeName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {member.email}
                  </small>
                </span>
                <span
                  className={`custom-checkbox-control flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white transition-all duration-200 ${selected ? "border-blue-600 bg-blue-600 shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white"}`}
                >
                  {selected && <Check className="checkbox-check-mark" size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {type === "GROUP" ? `선택 ${selectedIds.length}명 + 나` : `선택 ${selectedIds.length}명`}
        </p>
        <button
          onClick={() => void submit()}
          className="mt-5 h-11 w-full cursor-pointer rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[.98]"
        >
          메시지방 만들기
        </button>
      </section>
    </div>
  );
}

function GroupRoomDetail({
  room,
  accessToken,
  currentMemberId,
  members,
  onClose,
  onAction,
  onReloadMessages,
  onProfileClick,
  showToast,
}: {
  room: ChatRoom;
  accessToken: string;
  currentMemberId: number;
  members: AddressBookMember[];
  onClose: () => void;
  onAction: (
    action: "leave" | "invite" | "remove" | "owner" | "rename",
    targetId?: number,
    name?: string,
  ) => Promise<void>;
  onReloadMessages: () => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  showToast: (message: string) => void;
}) {
  const [name, setName] = useState(room.name ?? "");
  const [inviteId, setInviteId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [participants, setParticipants] = useState<ChatMemberProfile[]>([]);
  const inviteRef = useRef<HTMLDivElement>(null);
  const owner = room.ownerMembershipId === currentMemberId;
  // 전체 회사 구성원 중 현재 방에 없는 사람만 초대 후보로 제공.
  const inviteCandidates = members.filter(
    (member) =>
      !participants.some((participant) => participant.membershipId === member.membershipId),
  );
  const selectedInvite =
    inviteCandidates.find((member) => member.membershipId === inviteId) ?? null;

  const refreshParticipants = useCallback(async () => {
    const detail = await chatApi.detail(accessToken, room.id);
    setParticipants(detail.members);
  }, [accessToken, room.id]);

  useEffect(() => {
    void Promise.resolve()
      .then(refreshParticipants)
      .catch((error: Error) => showToast(error.message));
  }, [refreshParticipants, showToast]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(event.target as Node))
        setInviteOpen(false);
    };
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inviteOpen) setInviteOpen(false);
      else onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeByEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeByEscape);
    };
  }, [inviteOpen, onClose]);

  const run = async (
    action: "leave" | "invite" | "remove" | "owner" | "rename",
    targetId?: number,
  ) => {
    try {
      if (action === "rename" && !name.trim()) {
        showToast("그룹명을 입력해 주세요.");
        return;
      }
      if (action === "invite" && !inviteId) {
        showToast("초대할 구성원을 선택해 주세요.");
        return;
      }
      await onAction(action, targetId ?? inviteId ?? undefined, name);
      if (action === "invite") {
        await Promise.all([refreshParticipants(), onReloadMessages()]);
        setInviteId(null);
        setInviteOpen(false);
        showToast("구성원을 초대했습니다.");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
    }
  };

  return (
    <aside className="h-full w-[min(420px,40vw)] shrink-0 animate-in slide-in-from-right overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GroupAvatar name={room.name ?? "그룹"} size="lg" />
          <div>
            <b className="block">{room.name}</b>
            <p className="mt-1 text-sm text-slate-500">
              멤버{" "}
              <span className="font-bold text-blue-600">
                {participants.length || room.memberCount}
              </span>
            </p>
          </div>
        </div>
        <button
          aria-label="그룹 메시지 상세 닫기"
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-slate-500 transition hover:bg-slate-100"
        >
          <X />
        </button>
      </div>
      {owner && (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
          <label className="text-sm font-medium">
            그룹명
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"
            />
          </label>
          <button
            onClick={() => void run("rename")}
            className="h-9 cursor-pointer rounded-lg border border-blue-200 px-3 text-sm text-blue-700 transition hover:bg-blue-50"
          >
            변경
          </button>
          <div ref={inviteRef} className="relative">
            <p className="mb-1 text-sm font-medium">구성원 초대</p>
            <button
              type="button"
              aria-expanded={inviteOpen}
              onClick={() => setInviteOpen((open) => !open)}
              className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition hover:border-blue-300 focus:border-blue-500"
            >
              {selectedInvite ? (
                <>
                  <MessageMemberAvatar
                    name={selectedInvite.displayName}
                    presenceStatus={selectedInvite.presenceStatus}
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{selectedInvite.displayName}</b>
                    <small className="block truncate text-slate-500">
                      {[
                        selectedInvite.companyName,
                        selectedInvite.jobGradeName,
                        selectedInvite.departmentName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </>
              ) : (
                <span className="flex-1 text-slate-500">구성원을 선택하세요</span>
              )}
              <ChevronDown
                className={`shrink-0 transition-transform ${inviteOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
            {inviteOpen && (
              <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                {inviteCandidates.map((candidate) => (
                  <button
                    key={candidate.membershipId}
                    type="button"
                    onClick={() => {
                      setInviteId(candidate.membershipId);
                      setInviteOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-blue-50 ${inviteId === candidate.membershipId ? "bg-blue-50" : ""}`}
                  >
                    <MessageMemberAvatar
                      name={candidate.displayName}
                      presenceStatus={candidate.presenceStatus}
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-sm">{candidate.displayName}</b>
                      <small className="block truncate text-slate-500">
                        {[candidate.companyName, candidate.jobGradeName, candidate.departmentName]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </button>
                ))}
                {inviteCandidates.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-slate-500">
                    초대할 구성원이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            disabled={!inviteId}
            onClick={() => void run("invite")}
            className="h-9 cursor-pointer rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            초대
          </button>
        </div>
      )}
      <section className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-bold">
          멤버 <span className="text-blue-600">({participants.length || room.memberCount})</span>
        </h3>
        <div className="mt-2 max-h-[calc(100vh-25rem)] overflow-y-auto overflow-x-hidden">
          {participants.map((participant) => {
            const isRoomOwner = participant.membershipId === room.ownerMembershipId;
            const isMe = participant.membershipId === currentMemberId;
            const presenceStatus = isMe
              ? "ONLINE"
              : (members.find((member) => member.membershipId === participant.membershipId)
                  ?.presenceStatus ?? "OFFLINE");
            return (
              <div
                key={participant.membershipId}
                className="group mx-1 my-1 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-blue-50/80"
              >
                {/* 구성원 정보 영역은 클릭하면 공통 사용자 프로필 모달을 연다. */}
                <button
                  type="button"
                  onClick={() => onProfileClick(participant.membershipId)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`${participant.displayName} 사용자 프로필 보기`}
                >
                  <MessageMemberAvatar
                    name={participant.displayName}
                    presenceStatus={presenceStatus}
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">
                      {participant.displayName}
                      {isMe ? " (나)" : ""}
                    </b>
                    <small className="block truncate text-slate-500">
                      {[participant.jobGradeName, participant.departmentName]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </button>
                {isRoomOwner && (
                  <em className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] not-italic text-blue-600">
                    방장
                  </em>
                )}
                {owner && !isMe && (
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => void run("owner", participant.membershipId)}
                      className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[11px] transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      위임
                    </button>
                    <button
                      onClick={() => void run("remove", participant.membershipId)}
                      className="cursor-pointer rounded border border-red-100 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
                    >
                      내보내기
                    </button>
                  </span>
                )}
              </div>
            );
          })}
          {participants.length === 0 && (
            <LoadingState message="참여자를 불러오는 중입니다." className="py-6" />
          )}
        </div>
      </section>
      <button
        onClick={() => void run("leave")}
        className="mt-4 cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 active:scale-[.98]"
      >
        채팅방 나가기
      </button>
    </aside>
  );
}

function ReadMemberModal({
  modal,
  contactMembers,
  onClose,
  onProfileClick,
  onTab,
}: {
  modal: ReadModalState;
  contactMembers: AddressBookMember[];
  onClose: () => void;
  onProfileClick: (membershipId: number) => void;
  onTab: (read: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 행마다 주소록 배열을 다시 훑지 않도록 접속 상태를 Map으로 한 번만 만들어 둠.
  const presenceByMemberId = useMemo(
    () => new Map(contactMembers.map((member) => [member.membershipId, member.presenceStatus])),
    [contactMembers],
  );
  const members = modal.read ? modal.readMembers : modal.unreadMembers;
  const tabs = [
    { read: true, label: "읽음", count: modal.readMembers.length },
    { read: false, label: "안 읽음", count: modal.unreadMembers.length },
  ];
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.target === ref.current) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 인원수와 관계없이 모달 높이를 고정하고, 목록 영역만 스크롤되게 구성. */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="읽은 멤버"
        className="message-action-menu flex h-[min(680px,calc(100vh-2rem))] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            읽은 멤버 ({modal.readMembers.length})
          </h2>
          <button
            type="button"
            aria-label="읽은 멤버 닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-90"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {/* 선택한 탭은 아래 패널과 이어지도록 흰 배경으로 패널 테두리를 덮음. */}
        <div role="tablist" className="relative z-10 mt-5 flex shrink-0 gap-1">
          {tabs.map((tab) => {
            const selected = modal.read === tab.read;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTab(tab.read)}
                className={`-mb-px cursor-pointer rounded-t-lg border px-6 py-2.5 text-sm transition ${selected ? "border-slate-200 border-b-white bg-white font-semibold text-slate-900" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
              >
                {tab.label} {tab.count}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          className="min-h-0 flex-1 overflow-y-auto rounded-b-lg rounded-tr-lg border border-slate-200 p-2"
        >
          {members.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              {modal.read ? "읽은 멤버가 없습니다." : "안 읽은 멤버가 없습니다."}
            </p>
          ) : (
            members.map((member) => (
              <button
                type="button"
                key={member.membershipId}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100"
                onClick={() => onProfileClick(member.membershipId)}
              >
                <MessageMemberAvatar
                  name={member.displayName}
                  presenceStatus={presenceByMemberId.get(member.membershipId) ?? "OFFLINE"}
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-slate-900">{member.displayName}</b>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {member.jobGrade && <span className="text-blue-600">{member.jobGrade}</span>}
                    {member.jobGrade && member.departmentName && "/"}
                    {member.departmentName}
                    {member.companyName && <span className="ml-2">{member.companyName}</span>}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs ${modal.read ? "text-blue-600" : "text-slate-400"}`}
                >
                  {modal.read ? "읽음" : "안 읽음"}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function UserProfileModal({
  member,
  onClose,
  onToggleFavorite,
  onMessage,
  showToast,
}: {
  member: AddressBookMemberDetail;
  onClose: () => void;
  onToggleFavorite: () => Promise<void>;
  onMessage: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (event.target === ref.current) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const hiredAt = member.hiredAt
    ? new Date(member.hiredAt)
        .toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\. /g, ".")
        .replace(/\.$/, "")
    : "-";
  return (
    <div ref={ref} className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <section className="relative min-h-[620px] w-full max-w-[440px] animate-in fade-in zoom-in-95 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="absolute right-5 top-5 flex flex-col items-center gap-2">
          <button
            aria-label="프로필 닫기"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-slate-600 transition hover:bg-slate-100 active:scale-90"
          >
            <X size={22} />
          </button>
          <button
            aria-label="즐겨찾기 변경"
            onClick={() => void onToggleFavorite()}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition active:scale-90 ${member.favorite ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-slate-500 bg-transparent text-slate-500 hover:bg-slate-100"}`}
          >
            <Star size={14} fill={member.favorite ? "currentColor" : "none"} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-7 flex items-center gap-5">
          <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-800">
            <span className="whitespace-nowrap">{member.displayName.slice(0, 3)}</span>
            <span
              className={`absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${member.presenceStatus === "ONLINE" ? "bg-emerald-500" : member.presenceStatus === "OFFLINE" ? "bg-slate-300" : member.presenceStatus === "AWAY" ? "bg-slate-500 text-white" : "bg-red-500 text-white"}`}
            >
              {(member.presenceStatus === "AWAY" || member.presenceStatus === "INACTIVE") && (
                <X size={14} strokeWidth={3} />
              )}
            </span>
          </span>
          <div>
            <h2 className="text-xl font-bold">{member.displayName}</h2>
            <p className="mt-1 text-sm text-slate-500">{member.jobGradeName ?? "직급 미지정"}</p>
            <button
              type="button"
              onClick={() => showToast("일정 기능은 준비 중입니다.")}
              className="mt-2 flex cursor-pointer items-center gap-1 text-sm text-blue-600 transition hover:underline"
            >
              <CalendarDays size={15} />
              일정 보기
            </button>
          </div>
        </div>
        <div className="mt-14 grid grid-cols-3 gap-2 text-center text-sm text-blue-600">
          <button
            onClick={() => void onMessage()}
            className="cursor-pointer rounded-xl p-3 transition hover:bg-blue-50 active:scale-95"
          >
            <MessageCircle className="mx-auto mb-2" size={22} />
            메시지
          </button>
          <button
            onClick={() => showToast("메일 기능은 준비 중입니다.")}
            className="cursor-pointer rounded-xl p-3 transition hover:bg-blue-50 active:scale-95"
          >
            <Mail className="mx-auto mb-2" size={22} />
            메일
          </button>
          <button
            onClick={() => showToast("약속 초대 기능은 준비 중입니다.")}
            className="cursor-pointer rounded-xl p-3 transition hover:bg-blue-50 active:scale-95"
          >
            <CalendarDays className="mx-auto mb-2" size={22} />
            약속 초대
          </button>
        </div>
        <dl className="mt-10 space-y-5 text-sm">
          <div className="grid grid-cols-[92px_1fr] gap-3">
            <dt className="text-slate-500">소속</dt>
            <dd>
              <b className="block">{member.companyName}</b>
              <span>{member.departmentName ?? "부서 미지정"}</span>
            </dd>
          </div>
          <div className="grid grid-cols-[92px_1fr] gap-3">
            <dt className="text-slate-500">전화</dt>
            <dd>{member.phoneNumber ?? "-"}</dd>
          </div>
          <div className="grid grid-cols-[92px_1fr] gap-3">
            <dt className="text-slate-500">메일</dt>
            <dd className="underline">{member.email}</dd>
          </div>
          <div className="grid grid-cols-[92px_1fr] gap-3">
            <dt className="text-slate-500">입사일</dt>
            <dd>{hiredAt}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
