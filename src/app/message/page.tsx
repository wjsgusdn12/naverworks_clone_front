"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Forward,
  MoreVertical,
  Pin,
  EyeOff,
  LogOut,
  ImagePlus,
  Mail,
  MessageCircle,
  Paperclip,
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const dateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000,
  );
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
    if (left.pinned && right.pinned) return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftTime = new Date(left.lastMessageAt ?? left.createdAt).getTime();
    const rightTime = new Date(
      right.lastMessageAt ?? right.createdAt,
    ).getTime();
    return rightTime - leftTime;
  });

type RoomSort = "LATEST" | "TYPE" | "UNREAD";

const sortRooms = (rooms: ChatRoom[], sort: RoomSort) => {
  if (sort !== "UNREAD") return sortRoomsByLatestActivity(rooms);
  return [...rooms].sort((left, right) => {
    // 안 읽은 메시지 정렬에서도 고정한 방이 최우선.
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned) return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftHasUnread = left.unreadCount > 0;
    const rightHasUnread = right.unreadCount > 0;
    if (leftHasUnread !== rightHasUnread) return leftHasUnread ? -1 : 1;
    if (leftHasUnread && rightHasUnread) {
      // 첫 미확인 메시지가 더 오래된 방부터 확인하도록 오름차순 정렬.
      return (
        new Date(
          left.oldestUnreadMessageAt ?? left.lastMessageAt ?? left.createdAt,
        ).getTime() -
        new Date(
          right.oldestUnreadMessageAt ?? right.lastMessageAt ?? right.createdAt,
        ).getTime()
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
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [readModal, setReadModal] = useState<{
    message: ChatMessage;
    members: ChatReadMember[];
    read: boolean;
  } | null>(null);
  const [newRoomModalOpen, setNewRoomModalOpen] = useState(
    searchParams.get("create") === "group",
  );
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
  const [selectedRoomProfile, setSelectedRoomProfile] =
    useState<ChatMemberProfile | null>(null);
  const [profileMemberId, setProfileMemberId] = useState<number | null>(null);
  const [profileMember, setProfileMember] =
    useState<AddressBookMemberDetail | null>(null);
  const [scrollDateLabel, setScrollDateLabel] = useState<string | null>(null);
  const [scrollDatePhase, setScrollDatePhase] = useState<"visible" | "leaving">(
    "visible",
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldScrollToLatestRef = useRef(false);
  const preservedScrollRef = useRef<{ top: number; height: number } | null>(
    null,
  );
  const activeDateKeyRef = useRef<string | null>(null);
  const scrollDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollDateFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  // 탭 안에서 메시지 화면을 다시 열어도 마지막으로 보던 방을 복원.
  const lastRoomStorageKey = member
    ? `naverworks:message:lastRoom:${member.membershipId}`
    : null;
  // 반복 find를 피하도록 구성원 프로필을 화면 단위 Map으로 캐싱.
  const contactMemberById = useMemo(
    () =>
      new Map(contactMembers.map((contact) => [contact.membershipId, contact])),
    [contactMembers],
  );
  const openUserProfile = useCallback(
    (membershipId: number) => setProfileMemberId(membershipId),
    [],
  );

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
    return () =>
      document.removeEventListener("click", handleProfileAvatarClick, true);
  }, [contactMembers, member, openUserProfile]);

  const showDateChip = useCallback((label: string) => {
    if (scrollDateFadeTimerRef.current)
      clearTimeout(scrollDateFadeTimerRef.current);
    if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    setScrollDateLabel(label);
    setScrollDatePhase("visible");
    // 종료 직전에 투명도를 낮춘 뒤 DOM을 제거해 자연스럽게 사라지게 함.
    scrollDateFadeTimerRef.current = setTimeout(
      () => setScrollDatePhase("leaving"),
      2600,
    );
    scrollDateTimerRef.current = setTimeout(() => {
      setScrollDateLabel(null);
      activeDateKeyRef.current = null;
    }, 3000);
  }, []);

  const loadRooms = useCallback(async () => {
    if (!accessToken) return;
    const result = await chatApi.rooms(accessToken);
    setRooms(sortRoomsByLatestActivity(result));
    const savedRoomId =
      lastRoomStorageKey && typeof window !== "undefined"
        ? Number(window.sessionStorage.getItem(lastRoomStorageKey))
        : null;
    const requestedRoomExists = result.some(
      (room) => room.id === requestedRoomId,
    );
    const savedRoomExists = result.some((room) => room.id === savedRoomId);
    if (lastRoomStorageKey && savedRoomId && !savedRoomExists) {
      window.sessionStorage.removeItem(lastRoomStorageKey);
    }
    // URL로 직접 지정한 방을 우선하고, 없으면 탭 안에 저장한 마지막 방을 복원.
    setSelectedRoomId(
      (current) =>
        current ??
        (requestedRoomExists
          ? requestedRoomId
          : savedRoomExists
            ? savedRoomId
            : null),
    );
  }, [accessToken, lastRoomStorageKey, requestedRoomId]);

  useEffect(() => {
    if (!lastRoomStorageKey || !selectedRoomId) return;
    window.sessionStorage.setItem(lastRoomStorageKey, String(selectedRoomId));
  }, [lastRoomStorageKey, selectedRoomId]);

  const loadMessages = useCallback(
    async (roomId: number, cursor?: number) => {
      if (!accessToken) return;
      const result = await chatApi.messages(accessToken, roomId, cursor);
      // 이전 메시지를 위에 붙일 때는 사용자가 읽던 위치를 복원.
      if (cursor && messageListRef.current) {
        preservedScrollRef.current = {
          top: messageListRef.current.scrollTop,
          height: messageListRef.current.scrollHeight,
        };
      }
      // API 반환 순서와 무관하게 오래된 메시지부터 보여 최신 메시지가 항상 하단에 오게 함.
      const sortedMessages = [...result.messages].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      );
      setMessages((current) =>
        cursor ? [...sortedMessages, ...current] : sortedMessages,
      );
      setNextCursor(result.nextCursor);
      // 방에 들어오면 서버가 읽음 처리하므로 목록 배지도 즉시 함께 지움.
      if (!cursor)
        setRooms((current) =>
          current.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room,
          ),
        );
    },
    [accessToken],
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
      shouldScrollToLatestRef.current = true;
      // 방 진입 직후 최신 메시지의 날짜를 짧게 안내.
      activeDateKeyRef.current = null;
      void Promise.resolve()
        .then(() => loadMessages(selectedRoomId))
        .catch((error: Error) => showToast(error.message));
    }
  }, [loadMessages, selectedRoomId, showToast]);

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
            ? detail.members.find(
              (item) => item.membershipId === member.membershipId,
            )
            : detail.members.find(
              (item) => item.membershipId !== member.membershipId,
            );
        setSelectedRoomProfile(profile ?? null);
        setRooms((current) =>
          current.map((room) =>
            room.id === detail.room.id ? detail.room : room,
          ),
        );
      })
      .catch((error: Error) => showToast(error.message));
  }, [accessToken, member, selectedRoom?.type, selectedRoomId, showToast]);

  // 새 메시지·방 진입 결과가 렌더링되면 항상 가장 최근 대화가 보이도록 이동.
  useEffect(() => {
    if (!messageListRef.current) return;
    const messageList = messageListRef.current;
    const preservedScroll = preservedScrollRef.current;
    if (preservedScroll) {
      const frameId = requestAnimationFrame(() => {
        messageList.scrollTop =
          preservedScroll.top +
          messageList.scrollHeight -
          preservedScroll.height;
        preservedScrollRef.current = null;
      });
      return () => cancelAnimationFrame(frameId);
    }
    if (!shouldScrollToLatestRef.current) return;
    const frameId = requestAnimationFrame(() => {
      // 새 방의 메시지 DOM 높이가 계산된 뒤 최하단으로 이동.
      messageList.scrollTop = messageList.scrollHeight;
      shouldScrollToLatestRef.current = false;
    });
    return () => cancelAnimationFrame(frameId);
  }, [messages]);

  useEffect(() => {
    if (!shouldScrollToLatestRef.current || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    activeDateKeyRef.current = dateKey(latestMessage.createdAt);
    showDateChip(formatChatDate(latestMessage.createdAt));
  }, [messages, showDateChip]);

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
            (target) =>
              target.membershipId !== member?.membershipId && target.enabled,
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
  const renderRoomItem = (room: ChatRoom) => (
    <MessageRoomItem
      key={room.id}
      room={room}
      currentMember={member}
      contactMemberById={contactMemberById}
      isSelected={selectedRoomId === room.id}
      isCollapsed={isSidebarCollapsed}
      onClick={() => setSelectedRoomId(room.id)}
      onProfileClick={openUserProfile}
      menuOpen={roomMenuId === room.id}
      hideSelectionMode={hideSelectionMode}
      hiddenSelected={hiddenRoomIds.has(room.id)}
      onToggleMenu={() => setRoomMenuId((current) => current === room.id ? null : room.id)}
      onToggleHidden={() => setHiddenRoomIds((current) => { const next = new Set(current); if (next.has(room.id)) next.delete(room.id); else next.add(room.id); return next; })}
      onAction={async (action) => {
        if (!accessToken) return;
        setRoomMenuId(null);
        if (action === "hide") { setHideSelectionMode(true); setHiddenRoomIds(new Set([room.id])); return; }
        if (action === "leave") { await chatApi.leave(accessToken, room.id); setRooms((current) => current.filter((target) => target.id !== room.id)); if (selectedRoomId === room.id) setSelectedRoomId(null); showToast("채팅방에서 나갔습니다."); return; }
        if (action === "pin") { await chatApi.togglePin(accessToken, room.id); await loadRooms(); showToast(room.pinned ? "고정을 해제했습니다." : "채팅방을 고정했습니다."); return; }
        await chatApi.updateNotification(accessToken, room.id, !room.notificationEnabled); await loadRooms(); showToast(room.notificationEnabled ? "알림을 해제했습니다." : "알림을 설정했습니다.");
      }}
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
        displayName:
          selectedRoomProfile?.displayName ?? member?.displayName ?? "나",
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
    selectedRoom?.type === "SELF"
      ? member?.membershipId
      : selectedRoom?.directMembershipId;

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!accessToken || !selectedRoomId || !input.trim()) return;
    try {
      const message = await chatApi.send(
        accessToken,
        selectedRoomId,
        input.trim(),
      );
      shouldScrollToLatestRef.current = true;
      setMessages((current) => [...current, message]);
      setRooms((current) =>
        sortRoomsByLatestActivity(
          current.map((room) =>
            room.id === selectedRoomId
              ? {
                ...room,
                lastMessage: message.content,
                lastMessageAt: message.createdAt,
                lastSenderMembershipId: member?.membershipId ?? null,
                unreadCount: 0,
              }
              : room,
          ),
        ),
      );
      setInput("");
      inputRef.current?.focus();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "메시지를 보내지 못했습니다.",
      );
    }
  };

  const openReadMembers = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId || message.type !== "TEXT") return;
    try {
      const members = await chatApi.readMembers(
        accessToken,
        selectedRoomId,
        message.id,
        true,
      );
      setReadModal({ message, members, read: true });
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "읽음 멤버를 조회하지 못했습니다.",
      );
    }
  };

  const closeRoomManageModal = useCallback(() => setRoomManageOpen(false), []);

  const showScrollDate = (event: React.UIEvent<HTMLDivElement>) => {
    const messageElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-message-date]"),
    );
    const visibleMessage = messageElements.find(
      (element) =>
        element.offsetTop + element.offsetHeight >
        event.currentTarget.scrollTop + 8,
    );
    const nextDateKey = visibleMessage?.dataset.messageDate;
    if (!nextDateKey) return;
    // 같은 날짜 구간의 스크롤은 상태를 갱신하지 않아 전체 목록 재렌더링을 방지.
    if (activeDateKeyRef.current === nextDateKey) return;
    activeDateKeyRef.current = nextDateKey;
    showDateChip(visibleMessage?.dataset.messageLabel ?? "");
  };

  useEffect(
    () => () => {
      if (scrollDateFadeTimerRef.current)
        clearTimeout(scrollDateFadeTimerRef.current);
      if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const closeSortMenu = (event: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      )
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
            if (lastRoomStorageKey)
              window.sessionStorage.removeItem(lastRoomStorageKey);
            void logout().then(() => router.replace("/"));
          }}
          onSidebarToggle={() =>
            setIsSidebarCollapsed((collapsed) => !collapsed)
          }
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
                          {roomSort === option.value && (
                            <Check size={16} strokeWidth={3} />
                          )}
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
              <p className="p-8 text-center text-sm text-slate-500">
                표시할 메시지방이 없습니다.
              </p>
            )}
          </div>
          {hideSelectionMode && !isSidebarCollapsed && (
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
              <button type="button" disabled={hiddenRoomIds.size === 0} onClick={() => setHideConfirmOpen(true)} className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                숨김 ({hiddenRoomIds.size})
              </button>
              <button type="button" onClick={() => { setHideSelectionMode(false); setHiddenRoomIds(new Set()); }} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50">취소</button>
            </div>
          )}
        </aside>
        <section
          className={`min-w-0 flex-1 flex-col ${selectedRoom ? "flex" : "hidden"}`}
        >
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
                    <h1 className="font-bold">
                      {displayRoomName(selectedRoom)}
                    </h1>
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
                      headerMembershipId
                        ? () => openUserProfile(headerMembershipId)
                        : undefined
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
                      <span className="text-blue-600">
                        {headerProfile?.jobGradeName}
                      </span>
                      <span className="text-slate-500">
                        {headerProfile?.departmentName &&
                          ` · ${headerProfile.departmentName}`}
                        {headerProfile?.companyName &&
                          ` · ${headerProfile.companyName}`}
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
              <div
                ref={messageListRef}
                onScroll={showScrollDate}
                className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
              >
                {messages.map((message, index) => {
                  const label = formatChatDate(message.createdAt);
                  const showDate =
                    index === 0 ||
                    dateKey(messages[index - 1].createdAt) !==
                    dateKey(message.createdAt);
                  const sender = contactMemberById.get(
                    message.senderMembershipId,
                  );
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
                        data-message-date={dateKey(message.createdAt)}
                        data-message-label={label}
                      >
                        {message.type === "SYSTEM" ? (
                          <p className="my-5 text-center text-xs text-slate-400">
                            {message.content}
                          </p>
                        ) : (
                          <MessageBubble
                            message={message}
                            isMine={
                              message.senderMembershipId ===
                              member?.membershipId
                            }
                            isDirect={selectedRoom?.type === "DIRECT"}
                            isGroup={selectedRoom?.type === "GROUP"}
                            senderProfile={sender}
                            onOpenReadMembers={openReadMembers}
                            onProfileClick={openUserProfile}
                          />
                        )}
                      </div>
                    </Fragment>
                  );
                })}
                {nextCursor && (
                  <button
                    className="mx-auto block cursor-pointer text-xs text-blue-600 hover:underline"
                    onClick={() =>
                      selectedRoomId &&
                      void loadMessages(selectedRoomId, nextCursor)
                    }
                  >
                    이전 메시지 더 보기
                  </button>
                )}
              </div>
              <form
                onSubmit={submitMessage}
                className="m-5 rounded-2xl bg-slate-100 p-4"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitMessage();
                    }
                  }}
                  placeholder="메시지를 입력해주세요. (Enter: 전송 / Shift + Enter: 줄바꿈)"
                  className="h-24 w-full resize-none bg-transparent text-sm outline-none"
                />
                <div className="flex items-center gap-3 text-slate-600">
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
                    onClick={() =>
                      showToast("이미지 전송 기능은 준비 중입니다.")
                    }
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
            {roomManageOpen &&
              selectedRoom?.type === "GROUP" &&
              accessToken &&
              member && (
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
                      if (lastRoomStorageKey)
                        window.sessionStorage.removeItem(lastRoomStorageKey);
                      setRoomManageOpen(false);
                      setSelectedRoomId(null);
                      setMessages([]);
                      setNextCursor(null);
                      setInput("");
                      setRooms((current) =>
                        current.filter((room) => room.id !== selectedRoom.id),
                      );
                      router.replace("/message");
                      await loadRooms();
                      return;
                    }
                    if (action === "invite") {
                      await chatApi.invite(
                        accessToken,
                        selectedRoom.id,
                        targetId!,
                      );
                      await loadRooms();
                      return;
                    }
                    if (action === "remove")
                      await chatApi.remove(
                        accessToken,
                        selectedRoom.id,
                        targetId!,
                      );
                    else if (action === "owner")
                      await chatApi.transferOwner(
                        accessToken,
                        selectedRoom.id,
                        targetId!,
                      );
                    else
                      await chatApi.rename(accessToken, selectedRoom.id, name!);
                    setRoomManageOpen(false);
                    await loadRooms();
                  }}
                  showToast={showToast}
                />
              )}
          </div>
        </section>
      </main>
      {hideConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/25 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHideConfirmOpen(false); }}>
          <section className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-500">!</div>
            <h2 className="text-lg font-bold">메시지 내용은 삭제하지 않습니다.</h2>
            <div className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => setHideConfirmOpen(false)} className="cursor-pointer rounded-lg border border-slate-200 px-5 py-2.5 text-sm transition hover:bg-slate-50">취소</button><button type="button" onClick={() => { if (!accessToken) return; void Promise.all([...hiddenRoomIds].map((roomId) => chatApi.hide(accessToken, roomId))).then(async () => { setRooms((current) => current.filter((room) => !hiddenRoomIds.has(room.id))); if (selectedRoomId && hiddenRoomIds.has(selectedRoomId)) setSelectedRoomId(null); setHideConfirmOpen(false); setHideSelectionMode(false); setHiddenRoomIds(new Set()); showToast("메시지방을 숨겼습니다."); await loadRooms(); }).catch((error: Error) => showToast(error.message)); }} className="cursor-pointer rounded-lg border border-red-500 px-5 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50">숨김</button></div>
          </section>
        </div>
      )}
      {newRoomModalOpen && accessToken && (
        <NewRoomModal
          members={contactMembers}
          initialMemberIds={requestedMemberIds}
          initialType={
            searchParams.get("create") === "group" ? "GROUP" : "DIRECT"
          }
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
          onTab={async (read) => {
            if (!accessToken || !selectedRoomId) return;
            const members = await chatApi.readMembers(
              accessToken,
              selectedRoomId,
              readModal.message.id,
              read,
            );
            setReadModal({ ...readModal, members, read });
          }}
        />
      )}
      {profileMember && accessToken && (
        <UserProfileModal
          member={profileMember}
          onClose={() => setProfileMemberId(null)}
          onToggleFavorite={async () => {
            const nextFavorite = !profileMember.favorite;
            if (nextFavorite)
              await addressBookApi.createFavorite(
                accessToken,
                profileMember.membershipId,
              );
            else
              await addressBookApi.deleteFavorite(
                accessToken,
                profileMember.membershipId,
              );
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
            showToast(
              nextFavorite
                ? "즐겨찾기에 추가했습니다."
                : "즐겨찾기에서 해제했습니다.",
            );
          }}
          onMessage={async () => {
            const room =
              profileMember.membershipId === member?.membershipId
                ? await chatApi.createSelf(accessToken)
                : await chatApi.createDirect(
                  accessToken,
                  profileMember.membershipId,
                );
            setProfileMemberId(null);
            setSelectedRoomId(room.id);
            await loadRooms();
            router.push(`/message?roomId=${room.id}`);
          }}
          showToast={showToast}
        />
      )}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          phase={toast.phase}
          onClose={dismissToast}
        />
      )}
    </div>
  );
}

function MessageRoomItem({
  room,
  currentMember,
  contactMemberById,
  isSelected,
  isCollapsed,
  onClick,
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
  isCollapsed: boolean;
  onClick: () => void;
  onProfileClick: (membershipId: number) => void;
  menuOpen: boolean;
  hideSelectionMode: boolean;
  hiddenSelected: boolean;
  onToggleMenu: () => void;
  onToggleHidden: () => void;
  onAction: (action: "notification" | "pin" | "hide" | "leave") => void;
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
  const lastMessage = room.lastMessage ?? "대화를 시작해 보세요.";
  // 실제 Enter 줄바꿈만 두 줄 미리보기로 취급. 단순히 긴 한 줄은 다음 줄로 넘기지 않음.
  const previewLines = lastMessage.split(/\r?\n/);
  const hasLineBreak = previewLines.length > 1;
  const secondPreview =
    previewLines.length > 2 ? `${previewLines[1]} …` : previewLines[1];
  const sentByMe = room.lastSenderMembershipId === currentMember?.membershipId;
  const presenceStatus = isSelf
    ? "ONLINE"
    : (contactMemberById.get(room.directMembershipId ?? -1)?.presenceStatus ??
      "OFFLINE");

  return (
    <div data-room-menu className={`group relative flex w-[calc(100%-1rem)] gap-3 rounded-xl ${isCollapsed ? "mx-2 my-1 justify-center px-2 py-3" : "mx-2 my-1 px-3 py-3"} text-left transition-colors duration-200 hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}>
      {hideSelectionMode && !isCollapsed && <button type="button" role="checkbox" aria-checked={hiddenSelected} onClick={onToggleHidden} className={`custom-checkbox-button mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${hiddenSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{hiddenSelected && <Check size={14} strokeWidth={3} />}</button>}
      <button type="button" title={displayName} onClick={onClick} className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left">
        <span className="relative shrink-0">
          {room.type === "GROUP" ? (
            <GroupAvatar name={avatarName} />
          ) : (
            <MessageMemberAvatar
              name={avatarName}
              presenceStatus={presenceStatus}
              onClick={() =>
                onProfileClick(
                  isSelf ? currentMember!.membershipId : room.directMembershipId!,
                )
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
                <small className={`absolute right-3 top-3 whitespace-nowrap text-right leading-5 text-slate-500 transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}>
                  {formatRoomTime(room.lastMessageAt)}
                </small>
                <button ref={menuButtonRef} type="button" aria-label="메시지방 메뉴" onClick={(event) => { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ left: rect.left, top: rect.bottom + 6 }); onToggleMenu(); }} className={`absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-slate-600 opacity-0 transition-opacity duration-150 hover:bg-slate-200 group-hover:pointer-events-auto group-hover:opacity-100 ${menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none"}`}><MoreVertical size={17} /></button>
              </span>
            </span>
            <span className="mt-0.5 flex items-start gap-2">
              <span className="flex min-w-0 flex-1 items-start gap-1 text-slate-500">
                {sentByMe && (
                  <Forward
                    className="mt-0.5 shrink-0 text-slate-600"
                    size={15}
                    strokeWidth={3}
                  />
                )}
                <span className="min-w-0 flex-1 text-[16px]">
                  <small className="block truncate">
                    {previewLines[0] || " "}
                  </small>
                  {hasLineBreak && (
                    <small className="block truncate">
                      {secondPreview || " "}
                    </small>
                  )}
                </span>
              </span>
              {room.unreadCount > 0 && (
                <em className={`mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[12px] font-bold leading-none not-italic text-white transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}>
                  {room.unreadCount > 999 ? "999+" : room.unreadCount}
                </em>
              )}
            </span>
          </span>
        )}</button>
      {menuOpen && !isCollapsed && menuPosition && createPortal(<div data-room-menu className="fixed z-[200] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95" style={menuPosition}><button type="button" onClick={() => onAction("notification")} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><Bell size={15} />{room.notificationEnabled ? "알림 해제" : "알림 설정"}</button><button type="button" onClick={() => onAction("pin")} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><Pin size={15} />{room.pinned ? "핀 고정 해제" : "핀 고정"}</button><button type="button" onClick={() => onAction("hide")} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><EyeOff size={15} />숨김</button><button type="button" onClick={() => onAction("leave")} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut size={15} />나가기</button></div>, document.body)}
    </div>
  );
}

function GroupAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
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

function MessageBubble({
  message,
  isMine,
  isDirect,
  isGroup,
  senderProfile,
  onOpenReadMembers,
  onProfileClick,
}: {
  message: ChatMessage;
  isMine: boolean;
  isDirect: boolean;
  isGroup: boolean;
  senderProfile?: AddressBookMember;
  onOpenReadMembers: (message: ChatMessage) => Promise<void>;
  onProfileClick: (membershipId: number) => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  // 그룹방은 발신자와 관계없이 모든 일반 메시지의 실제 읽음 상태를 표시.
  const readLabel =
    isMine && isDirect && message.unreadCount === 0 ? (
      <span className="mb-0.5 text-[12px] font-medium text-blue-600">읽음</span>
    ) : isGroup && message.readCount > 0 ? (
      <button
        className="mb-0.5 inline-flex cursor-pointer items-center gap-0.5 text-[12px] font-medium text-blue-600 transition hover:underline"
        onClick={() => void onOpenReadMembers(message)}
      >
        {isMine ? <ChevronLeft size={15} strokeWidth={2} /> : null}읽음{" "}
        {message.readCount}
        {!isMine ? <ChevronRight size={15} strokeWidth={2} /> : null}
      </button>
    ) : null;
  // 메타 영역도 말풍선에 맞닿는 방향으로 정렬해 읽음·시간이 떨어지지 않게 함.
  const meta = (
    <div
      className={`flex shrink-0 flex-col pb-1 text-[12px] text-slate-400 ${isMine ? "items-end text-right" : "items-start text-left"}`}
    >
      {readLabel}
      <span>{time}</span>
    </div>
  );
  // 꼬리는 프로필 쪽을 향하는 위쪽 대각선의 직각삼각형으로 표현.
  const bubble = (
    <div
      className={`relative ${isGroup && !isMine ? "max-w-full" : "max-w-[70%]"} whitespace-pre-wrap break-words px-4 py-3 text-sm leading-6 ${isMine ? "rounded-2xl bg-blue-100 after:absolute after:-right-2 after:top-3 after:h-3 after:w-3 after:bg-blue-100 after:[clip-path:polygon(0_0,0_100%,100%_0)]" : "rounded-2xl bg-slate-100 after:absolute after:-left-2 after:top-3 after:h-3 after:w-3 after:bg-slate-100 after:[clip-path:polygon(100%_0,100%_100%,0_0)]"}`}
    >
      {message.content}
    </div>
  );
  if (!isMine && isGroup) {
    // 그룹방 제3자 메시지는 프로필을 기준으로 말풍선 꼬리가 왼쪽을 향하게 배치.
    return (
      <div className="mb-4 flex items-start gap-2">
        <MessageMemberAvatar
          name={senderProfile?.displayName ?? message.senderName}
          presenceStatus={senderProfile?.presenceStatus ?? "OFFLINE"}
          onClick={() => onProfileClick(message.senderMembershipId)}
        />
        <div className="min-w-0 max-w-[70%]">
          <button
            type="button"
            onClick={() => onProfileClick(message.senderMembershipId)}
            className="cursor-pointer text-left text-sm font-bold transition hover:text-blue-600"
          >
            {senderProfile?.displayName ?? message.senderName}
          </button>
          <div className="mt-1 flex items-end gap-2">
            {bubble}
            {meta}
          </div>
        </div>
      </div>
    );
  }
  // 내 말풍선은 시간→말풍선, 상대 말풍선은 말풍선→시간 순서.
  return (
    <div className={`mb-4 ${isMine ? "ml-auto" : "mr-auto"} max-w-[85%]`}>
      <div
        className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
      >
        {isMine ? (
          <>
            {meta}
            {bubble}
          </>
        ) : (
          <>
            {bubble}
            {meta}
          </>
        )}
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
  onCreate: (
    type: "DIRECT" | "GROUP",
    name: string,
    memberIds: number[],
  ) => Promise<void>;
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
      showToast(
        error instanceof Error
          ? error.message
          : "메시지방을 만들지 못했습니다.",
      );
    }
  };
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4"
    >
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
                  {selected && (
                    <Check
                      className="checkbox-check-mark"
                      size={14}
                      strokeWidth={3}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {type === "GROUP"
            ? `선택 ${selectedIds.length}명 + 나`
            : `선택 ${selectedIds.length}명`}
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
      !participants.some(
        (participant) => participant.membershipId === member.membershipId,
      ),
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
      if (
        inviteRef.current &&
        !inviteRef.current.contains(event.target as Node)
      )
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
      showToast(
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
      );
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
                    <b className="block truncate">
                      {selectedInvite.displayName}
                    </b>
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
                <span className="flex-1 text-slate-500">
                  구성원을 선택하세요
                </span>
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
                      <b className="block truncate text-sm">
                        {candidate.displayName}
                      </b>
                      <small className="block truncate text-slate-500">
                        {[
                          candidate.companyName,
                          candidate.jobGradeName,
                          candidate.departmentName,
                        ]
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
          멤버{" "}
          <span className="text-blue-600">
            ({participants.length || room.memberCount})
          </span>
        </h3>
        <div className="mt-2 max-h-[calc(100vh-25rem)] overflow-y-auto overflow-x-hidden">
          {participants.map((participant) => {
            const isRoomOwner =
              participant.membershipId === room.ownerMembershipId;
            const isMe = participant.membershipId === currentMemberId;
            const presenceStatus = isMe
              ? "ONLINE"
              : (members.find(
                (member) => member.membershipId === participant.membershipId,
              )?.presenceStatus ?? "OFFLINE");
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
                      onClick={() =>
                        void run("owner", participant.membershipId)
                      }
                      className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[11px] transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      위임
                    </button>
                    <button
                      onClick={() =>
                        void run("remove", participant.membershipId)
                      }
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
            <p className="p-3 text-center text-sm text-slate-500">
              참여자를 불러오는 중입니다.
            </p>
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
  modal: { message: ChatMessage; members: ChatReadMember[]; read: boolean };
  contactMembers: AddressBookMember[];
  onClose: () => void;
  onProfileClick: (membershipId: number) => void;
  onTab: (read: boolean) => Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div
      ref={ref}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4"
    >
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            읽은 멤버 ({modal.members.length})
          </h2>
          <button className="cursor-pointer p-1" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="mt-4 flex border-b border-slate-200">
          <button
            className={`cursor-pointer px-4 py-2 text-sm ${modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`}
            onClick={() => void onTab(true)}
          >
            읽음
          </button>
          <button
            className={`cursor-pointer px-4 py-2 text-sm ${!modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`}
            onClick={() => void onTab(false)}
          >
            안 읽음
          </button>
        </div>
        <div className="mt-3 max-h-[420px] overflow-y-auto">
          {modal.members.map((member) => (
            <button
              key={member.membershipId}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
              onClick={() => onProfileClick(member.membershipId)}
            >
              <MessageMemberAvatar
                name={member.displayName}
                presenceStatus={
                  contactMembers.find(
                    (target) => target.membershipId === member.membershipId,
                  )?.presenceStatus ?? "OFFLINE"
                }
              />
              <span>
                <b className="block">{member.displayName}</b>
                <small className="text-slate-500">
                  {[member.jobGrade, member.departmentName]
                    .filter(Boolean)
                    .join("/")}
                </small>
              </span>
              <small className="ml-auto text-blue-600">
                {modal.read ? "읽음" : "안 읽음"}
              </small>
            </button>
          ))}
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
    <div
      ref={ref}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
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
            <Star
              size={14}
              fill={member.favorite ? "currentColor" : "none"}
              strokeWidth={2.5}
            />
          </button>
        </div>
        <div className="mt-7 flex items-center gap-5">
          <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-800">
            <span className="whitespace-nowrap">
              {member.displayName.slice(0, 3)}
            </span>
            <span
              className={`absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${member.presenceStatus === "ONLINE" ? "bg-emerald-500" : member.presenceStatus === "OFFLINE" ? "bg-slate-300" : member.presenceStatus === "AWAY" ? "bg-slate-500 text-white" : "bg-red-500 text-white"}`}
            >
              {(member.presenceStatus === "AWAY" ||
                member.presenceStatus === "INACTIVE") && (
                  <X size={14} strokeWidth={3} />
                )}
            </span>
          </span>
          <div>
            <h2 className="text-xl font-bold">{member.displayName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {member.jobGradeName ?? "직급 미지정"}
            </p>
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
