"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import {
  DELETE_EXPIRED_MESSAGE,
  EDIT_EXPIRED_MESSAGE,
  REACTION_EXPIRED_MESSAGE,
} from "@/components/chat/message-action-menu";
import { LoadingInline, LoadingState, PageLoading } from "@/components/common/loading";
import { MessageDeleteDialog } from "@/components/chat/message-change-dialog";
import { ForwardMessageModal } from "@/components/chat/forward-message-modal";
import { NoticePanel } from "@/components/chat/notice-panel";
import { GroupRoomDetail } from "@/components/chat/group-room-detail";
import { MessageList } from "@/components/chat/message-list";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageRoomHeader } from "@/components/chat/message-room-header";
import { MessageRoomSidebar } from "@/components/chat/message-room-sidebar";
import { MessageRoomItem } from "@/components/chat/message-room-item";
import { NewRoomModal } from "@/components/chat/new-room-modal";
import { ReactionMemberModal } from "@/components/chat/reaction-member-modal";
import { ReadMemberModal } from "@/components/chat/read-member-modal";
import { TypingBubble } from "@/components/chat/typing-bubble";
import { UserProfileModal } from "@/components/chat/user-profile-modal";
import {
  applyMessageChange,
  applyReactionChange,
  applyReadCursors,
  applyRoomMessageChange,
  type ReadState,
} from "@/lib/chat-message-state";
import { dateKey, formatChatDate } from "@/lib/chat-format";
import {
  clampInputHeight,
  inputHeightStorageKey,
  readStoredInputHeight,
} from "@/lib/chat-input-height";
import {
  isMessageEditable,
  type ReactionModalState,
  type ReadModalState,
} from "@/lib/chat-page-helpers";
import { sortRooms, sortRoomsByLatestActivity, type RoomSort } from "@/lib/chat-room-sort";
import { useAuth } from "@/components/auth/auth-provider";
import {
  chatApi,
  type ChatMemberProfile,
  type ChatMessage,
  type ChatNotice,
  type ChatRoom,
} from "@/lib/api/chat-api";
import {
  addressBookApi,
  type AddressBookMember,
  type AddressBookMemberDetail,
} from "@/lib/api/address-book-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { connectChatRoom } from "@/lib/realtime/chat-realtime";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ChevronDown, MessageCircle, Search, X } from "lucide-react";
import { withLiveStatus } from "@/lib/live-status";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function MessagePage() {
  // URL 쿼리(roomId)는 런타임 값이라 Suspense 경계 안에서 읽음.
  return (
    <Suspense fallback={<PageLoading />}>
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
  const {
    setActiveChatRoomId,
    syncChatRooms,
    refreshChatRooms,
    presenceByMembershipId,
    memberStatusByMembershipId,
    myStatusType,
  } = useChatNotification();
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
  // 구성원 목록을 한 번이라도 받아 왔는지. 받기 전에는 구성원 목록 자리에 로딩 표시.
  const [contactsLoaded, setContactsLoaded] = useState(false);
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
  // 현재 방의 공지 목록(최근 등록이 앞)과 전달 모달에 올린 메시지.
  const [notices, setNotices] = useState<ChatNotice[]>([]);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
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
  // 공지 카드 래퍼. 높이를 재서 날짜 칩·안내문을 그만큼 아래로 내림(아이콘 상태면 0).
  const noticePanelRef = useRef<HTMLDivElement>(null);
  const [noticePanelHeight, setNoticePanelHeight] = useState(0);
  useEffect(() => {
    const wrapper = noticePanelRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) =>
      setNoticePanelHeight(Math.round(entry.contentRect.height)),
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);
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
  // 말풍선 메뉴가 "공지 내리기"로 바뀌어야 하는 메시지 ID 집합.
  const noticeMessageIds = useMemo(
    () => new Set(notices.map((notice) => notice.messageId)),
    [notices],
  );
  // 반복 find를 피하도록 구성원 프로필을 화면 단위 Map으로 캐싱.
  const contactMemberById = useMemo(
    () =>
      new Map(
        contactMembers.map((contact) => [
          contact.membershipId,
          withLiveStatus(contact, presenceByMembershipId, memberStatusByMembershipId),
        ]),
      ),
    [contactMembers, presenceByMembershipId, memberStatusByMembershipId],
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
    setNotices(detail.notices);
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
      // 공지 등록·교체·해제는 모든 참여자 화면의 띠를 바로 갱신.
      onNoticeChanged: (event) => setNotices(event.notices),
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
      void Promise.resolve().then(() => {
        setRoomMentionMembers([]);
        setNotices([]);
      });
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
      .catch((error: Error) => showToast(error.message))
      .finally(() => setContactsLoaded(true));
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
  // 나와의 채팅은 이름만 돌려주고, "나" 딱지는 각 화면이 이름 왼쪽에 붙임.
  const displayRoomName = (room: ChatRoom) =>
    room.type === "SELF"
      ? (member?.displayName ?? "나")
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

  // 전달 모달에서 고른 방마다 복사해 보냄. 성공하면 true를 돌려 모달이 닫히게 함.
  const submitForward = async (targetRoomIds: number[]) => {
    if (!accessToken || !selectedRoomId || !forwardTarget) return false;
    try {
      const copies = await chatApi.forwardMessage(
        accessToken,
        selectedRoomId,
        forwardTarget.id,
        targetRoomIds,
      );
      // 현재 방으로 전달한 복사본은 실시간 이벤트를 기다리지 않고 바로 붙임.
      const toThisRoom = copies.find(() => targetRoomIds.includes(selectedRoomId));
      if (toThisRoom) {
        shouldScrollToLatestRef.current = true;
        setMessages((current) =>
          current.some((item) => item.id === toThisRoom.id)
            ? current
            : withReadCounts([...current, toThisRoom]),
        );
      }
      showToast(`${copies.length}개 메시지방에 전달했습니다.`);
      void loadRooms().catch(() => undefined);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지를 전달하지 못했습니다.");
      return false;
    }
  };

  // 메뉴의 "공지로 등록"/"공지 내리기". 이미 공지인 메시지면 내리고, 아니면 목록에 추가.
  const toggleNotice = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId || message.deletedAt || message.type !== "TEXT") return;
    if (notices.some((item) => item.messageId === message.id)) {
      await removeNotice(message.id);
      return;
    }
    try {
      setNotices(await chatApi.updateNotice(accessToken, selectedRoomId, message.id));
      showToast("공지로 등록했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공지를 등록하지 못했습니다.");
    }
  };

  // 공지 내리기: 모든 참여자의 공지 목록에서 사라짐("다시 보지 않기"는 내 화면에서만 숨김).
  const removeNotice = async (messageId: number) => {
    if (!accessToken || !selectedRoomId) return;
    try {
      setNotices(await chatApi.removeNotice(accessToken, selectedRoomId, messageId));
      showToast("공지를 내렸습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공지를 내리지 못했습니다.");
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
  const stableStartForward = useStableCallback((message: ChatMessage) => setForwardTarget(message));
  const stableToggleNotice = useStableCallback(
    (message: ChatMessage) => void toggleNotice(message),
  );
  const stableDisplayRoomName = useStableCallback(displayRoomName);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      {member && (
        <GlobalHeader
          role={member.role}
          pageTitle="메시지"
          isAuthenticated
          profileName={member.displayName}
          onToast={showToast}
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
      <main className="flex min-h-0 flex-1">
        <MessageRoomSidebar
          isSidebarCollapsed={isSidebarCollapsed}
          roomsLoaded={hasLoadedRooms}
          onCreateRoom={() => setNewRoomModalOpen(true)}
          sortMenuRef={sortMenuRef}
          sortMenuOpen={sortMenuOpen}
          onToggleSortMenu={() => setSortMenuOpen((open) => !open)}
          roomSort={roomSort}
          onSelectSort={(value) => {
            setRoomSort(value);
            setSortMenuOpen(false);
          }}
          filteredRooms={filteredRooms}
          groupRooms={groupRooms}
          generalRooms={generalRooms}
          groupCategoryOpen={groupCategoryOpen}
          onToggleGroupCategory={() => setGroupCategoryOpen((open) => !open)}
          generalCategoryOpen={generalCategoryOpen}
          onToggleGeneralCategory={() => setGeneralCategoryOpen((open) => !open)}
          renderRoomItem={renderRoomItem}
          hideSelectionMode={hideSelectionMode}
          hiddenRoomCount={hiddenRoomIds.size}
          onConfirmHide={() => setHideConfirmOpen(true)}
          onCancelHide={() => {
            setHideSelectionMode(false);
            setHiddenRoomIds(new Set());
          }}
        />
        <section className={`min-w-0 flex-1 flex-col ${selectedRoom ? "flex" : "hidden"}`}>
          <MessageRoomHeader
            selectedRoom={selectedRoom}
            roomManageOpen={roomManageOpen}
            onToggleRoomManage={() => setRoomManageOpen((open) => !open)}
            displayRoomName={displayRoomName}
            headerProfile={headerProfile}
            directPresenceStatus={addressBookProfile?.presenceStatus}
            directStatusType={addressBookProfile?.statusType}
            headerMembershipId={headerMembershipId}
            onProfileClick={openUserProfile}
          />
          <div className="flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1 flex-col">
              {/* 공지 카드가 떠 있는 동안 날짜 칩·안내문이 가려지지 않게 카드 높이만큼 아래로 내림. */}
              <div
                ref={noticePanelRef}
                className="pointer-events-none absolute inset-x-0 top-0 z-30"
              >
                {notices.length > 0 && selectedRoomId && (
                  <NoticePanel
                    key={selectedRoomId}
                    roomId={selectedRoomId}
                    notices={notices}
                    onOpen={stableJumpToOriginal}
                    onRemove={(messageId) => void removeNotice(messageId)}
                  />
                )}
              </div>
              {scrollDateLabel && (
                <div
                  style={{ top: 16 + noticePanelHeight }}
                  className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm transition-all duration-300 ${scrollDatePhase === "visible" ? "animate-in fade-in zoom-in-95 opacity-100" : "scale-95 opacity-0"}`}
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
                  style={{ top: 56 + noticePanelHeight }}
                  className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm animate-in fade-in slide-in-from-top-1"
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
                  myDisplayName={member?.displayName ?? null}
                  myStatusType={myStatusType}
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
                  onForward={stableStartForward}
                  onToggleNotice={stableToggleNotice}
                  noticeMessageIds={noticeMessageIds}
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
              <MessageComposer
                composerRef={composerRef}
                inputRef={inputRef}
                input={input}
                inputHeight={inputHeight}
                replyTarget={replyTarget}
                editingTarget={editingTarget}
                contactMemberById={contactMemberById}
                myMembershipId={member?.membershipId}
                mentionStartIndex={mentionStartIndex}
                mentionHighlightIndex={mentionHighlightIndex}
                visibleMentionCandidates={visibleMentionCandidates}
                onSubmit={submitMessage}
                onInput={handleMessageInput}
                onResizeInput={resizeInput}
                onSaveInputHeight={saveInputHeight}
                onCancelReply={cancelReply}
                onCancelEdit={cancelEdit}
                onMentionHighlightIndexChange={setMentionHighlightIndex}
                onCloseMention={() => setMentionStartIndex(null)}
                onSelectMention={selectMention}
                onProfileClick={openUserProfile}
                showToast={showToast}
              />
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
          membersLoaded={contactsLoaded}
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
      {forwardTarget && (
        <ForwardMessageModal
          message={forwardTarget}
          rooms={rooms}
          roomName={stableDisplayRoomName}
          onClose={() => setForwardTarget(null)}
          onSubmit={submitForward}
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
