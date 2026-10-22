"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { chatApi, type ChatMemberProfile, type ChatMessage, type ChatReadMember, type ChatRoom } from "@/lib/api/chat-api";
import { addressBookApi, type AddressBookMember, type PresenceStatus } from "@/lib/api/address-book-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { Forward, ImagePlus, Paperclip, Search, SmilePlus, UsersRound, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";

const dateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const formatChatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "numeric", day: "numeric", weekday: "short",
}).format(new Date(value));

const formatRoomTime = (value: string | null) => {
  if (!value) return "";
  const target = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000);
  if (dayDifference === 0) return target.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (dayDifference === 1) return "어제";
  return `${String(target.getMonth() + 1).padStart(2, "0")}. ${String(target.getDate()).padStart(2, "0")}.`;
};

export default function MessagePage() {
  // URL 쿼리(roomId)는 런타임 값이라 Suspense 경계 안에서 읽음.
  return <Suspense fallback={<div className="min-h-screen bg-slate-100" />}><MessageContent /></Suspense>;
}

function MessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoomId = Number(searchParams.get("roomId"));
  const requestedMemberIds = (searchParams.get("memberIds") ?? "").split(",").map(Number).filter(Number.isInteger);
  const { accessToken, member, status, logout } = useAuth();
  const { toast, showToast, dismissToast } = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [readModal, setReadModal] = useState<{ message: ChatMessage; members: ChatReadMember[]; read: boolean } | null>(null);
  const [newRoomModalOpen, setNewRoomModalOpen] = useState(searchParams.get("create") === "group");
  const [contactMembers, setContactMembers] = useState<AddressBookMember[]>([]);
  const [roomManageOpen, setRoomManageOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedRoomProfile, setSelectedRoomProfile] = useState<ChatMemberProfile | null>(null);
  const [scrollDateLabel, setScrollDateLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldScrollToLatestRef = useRef(false);
  const preservedScrollRef = useRef<{ top: number; height: number } | null>(null);
  const activeDateKeyRef = useRef<string | null>(null);
  const scrollDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  const loadRooms = useCallback(async () => {
    if (!accessToken) return;
    const result = await chatApi.rooms(accessToken);
    setRooms(result);
    // 기본 진입에서는 방을 선택하지 않아 목록 조회만으로 읽음 처리되지 않게 함.
    // 주소록·새 방 생성처럼 URL에 방 ID가 명시된 경우만 바로 진입.
    setSelectedRoomId((current) => current ?? (result.some((room) => room.id === requestedRoomId) ? requestedRoomId : null));
  }, [accessToken, requestedRoomId]);

  const loadMessages = useCallback(async (roomId: number, cursor?: number) => {
    if (!accessToken) return;
    const result = await chatApi.messages(accessToken, roomId, cursor);
    // 이전 메시지를 위에 붙일 때는 사용자가 읽던 위치를 복원.
    if (cursor && messageListRef.current) {
      preservedScrollRef.current = { top: messageListRef.current.scrollTop, height: messageListRef.current.scrollHeight };
    }
    // API 반환 순서와 무관하게 오래된 메시지부터 보여 최신 메시지가 항상 하단에 오게 함.
    const sortedMessages = [...result.messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    setMessages((current) => cursor ? [...sortedMessages, ...current] : sortedMessages);
    setNextCursor(result.nextCursor);
    // 방에 들어오면 서버가 읽음 처리하므로 목록 배지도 즉시 함께 지움.
    if (!cursor) setRooms((current) => current.map((room) => room.id === roomId ? { ...room, unreadCount: 0 } : room));
  }, [accessToken]);

  useEffect(() => {
    if (status === "unauthenticated") { markAuthenticationRequired(); router.replace("/"); return; }
    if (status === "authenticated") void Promise.resolve().then(loadRooms).catch((error: Error) => showToast(error.message));
  }, [loadRooms, router, showToast, status]);

  useEffect(() => {
    if (selectedRoomId) {
      shouldScrollToLatestRef.current = true;
      void Promise.resolve().then(() => loadMessages(selectedRoomId)).catch((error: Error) => showToast(error.message));
    }
  }, [loadMessages, selectedRoomId, showToast]);

  useEffect(() => {
    if (!accessToken || !selectedRoomId || !["DIRECT", "SELF"].includes(selectedRoom?.type ?? "") || !member) {
      // 이전 1:1 방의 프로필이 새 방에 잠깐 보이지 않도록 초기화.
      void Promise.resolve().then(() => setSelectedRoomProfile(null));
      return;
    }
    // 채팅방 참여자 목록으로 상단에 표시할 상대/본인 프로필을 확정.
    void chatApi.detail(accessToken, selectedRoomId).then((detail) => {
      const profile = selectedRoom?.type === "SELF"
        ? detail.members.find((item) => item.membershipId === member.membershipId)
        : detail.members.find((item) => item.membershipId !== member.membershipId);
      setSelectedRoomProfile(profile ?? null);
      setRooms((current) => current.map((room) => room.id === detail.room.id ? detail.room : room));
    }).catch((error: Error) => showToast(error.message));
  }, [accessToken, member, selectedRoom?.type, selectedRoomId, showToast]);

  // 새 메시지·방 진입 결과가 렌더링되면 항상 가장 최근 대화가 보이도록 이동.
  useEffect(() => {
    if (!messageListRef.current) return;
    const messageList = messageListRef.current;
    const preservedScroll = preservedScrollRef.current;
    if (preservedScroll) {
      const frameId = requestAnimationFrame(() => {
        messageList.scrollTop = preservedScroll.top + messageList.scrollHeight - preservedScroll.height;
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
    if (!accessToken || status !== "authenticated") return;
    void Promise.resolve().then(async () => {
      const result = await addressBookApi.member(accessToken, new URLSearchParams({ page: "0", size: "100", sort: "name", direction: "asc" }));
      setContactMembers(result.content.filter((target) => target.membershipId !== member?.membershipId && target.enabled));
    }).catch((error: Error) => showToast(error.message));
  }, [accessToken, member?.membershipId, showToast, status]);

  const filteredRooms = rooms.filter((room) => `${room.name ?? ""} ${room.directDisplayName ?? ""} ${room.type === "SELF" ? member?.displayName ?? "" : ""}`.toLowerCase().includes(search.toLowerCase()));
  const displayRoomName = (room: ChatRoom) => room.type === "SELF" ? `[나] ${member?.displayName ?? "나"}` : room.type === "DIRECT" ? room.directDisplayName ?? "사용자" : room.name ?? "그룹 메시지";
  const directProfile = selectedRoom?.type === "SELF" ? member : contactMembers.find((target) => target.membershipId === selectedRoom?.directMembershipId);
  // 로그인 사용자와 주소록 사용자는 상세 필드가 달라 주소록 프로필만 별도로 사용.
  const addressBookProfile = directProfile && "jobGradeName" in directProfile ? directProfile : null;
  // 1:1 방 헤더는 목록 API가 제공한 상대방 정보를 우선 사용. 내 정보로 대체하지 않음.
  const headerProfile = selectedRoom?.type === "SELF"
    ? { displayName: selectedRoomProfile?.displayName ?? member?.displayName ?? "나", jobGradeName: selectedRoomProfile?.jobGradeName ?? "", departmentName: selectedRoomProfile?.departmentName ?? "", companyName: selectedRoomProfile?.companyName ?? "" }
    : selectedRoom?.type === "DIRECT"
      ? { displayName: selectedRoomProfile?.displayName ?? addressBookProfile?.displayName ?? selectedRoom.directDisplayName ?? "상대 사용자", jobGradeName: selectedRoomProfile?.jobGradeName ?? addressBookProfile?.jobGradeName ?? selectedRoom.directJobGradeName ?? "", departmentName: selectedRoomProfile?.departmentName ?? addressBookProfile?.departmentName ?? selectedRoom.directDepartmentName ?? "", companyName: selectedRoomProfile?.companyName ?? addressBookProfile?.companyName ?? selectedRoom.directCompanyName ?? "" }
      : null;

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!accessToken || !selectedRoomId || !input.trim()) return;
    try {
      const message = await chatApi.send(accessToken, selectedRoomId, input.trim());
      shouldScrollToLatestRef.current = true;
      setMessages((current) => [...current, message]); setRooms((current) => current.map((room) => room.id === selectedRoomId ? { ...room, lastMessage: message.content, lastMessageAt: message.createdAt, lastSenderMembershipId: member?.membershipId ?? null, unreadCount: 0 } : room)); setInput(""); inputRef.current?.focus();
    } catch (error) { showToast(error instanceof Error ? error.message : "메시지를 보내지 못했습니다."); }
  };

  const openReadMembers = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId || message.type !== "TEXT") return;
    try { const members = await chatApi.readMembers(accessToken, selectedRoomId, message.id, true); setReadModal({ message, members, read: true }); }
    catch (error) { showToast(error instanceof Error ? error.message : "읽음 멤버를 조회하지 못했습니다."); }
  };

  const closeRoomManageModal = useCallback(() => setRoomManageOpen(false), []);

  const showScrollDate = (event: React.UIEvent<HTMLDivElement>) => {
    const messageElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-message-date]"));
    const visibleMessage = messageElements.find((element) => element.offsetTop + element.offsetHeight > event.currentTarget.scrollTop + 8);
    const nextDateKey = visibleMessage?.dataset.messageDate;
    if (!nextDateKey || nextDateKey === activeDateKeyRef.current) return;
    activeDateKeyRef.current = nextDateKey;
    setScrollDateLabel(visibleMessage?.dataset.messageLabel ?? null);
    if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    scrollDateTimerRef.current = setTimeout(() => setScrollDateLabel(null), 3000);
  };

  useEffect(() => () => { if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current); }, []);

  return <div className="min-h-screen bg-white text-slate-900">
    {member && <GlobalHeader role={member.role} pageTitle="메시지" isAuthenticated profileName={member.displayName} profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`} isProfileMenuOpen={isProfileOpen} onHomeAction={() => router.push("/home")} onServiceAction={(label) => label === "주소록" || label === "조직도" ? router.push("/addressBook") : label === "메시지" ? router.push("/message") : showToast(`${label} 기능은 준비 중입니다.`)} onProfileAction={() => setIsProfileOpen((open) => !open)} onCloseProfileMenu={() => setIsProfileOpen(false)} onLogout={() => void logout().then(() => router.replace("/"))} onSidebarToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)} isSidebarCollapsed={isSidebarCollapsed} headerContent={<label className="flex h-10 w-full max-w-[500px] items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-500"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="채팅방, 대화 상대 검색" className="w-full bg-transparent text-sm outline-none" /></label>} />}
    <main className="flex h-[calc(100vh-3.5rem)] min-h-[620px]">
      <aside className={`flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ${isSidebarCollapsed ? "w-20" : "w-[360px]"}`}>
        <button onClick={() => setNewRoomModalOpen(true)} className={`m-3 h-11 cursor-pointer rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[.98] ${isSidebarCollapsed ? "text-xl" : ""}`}>{isSidebarCollapsed ? "+" : "새로 만들기"}</button>
        {!isSidebarCollapsed && <p className="px-5 pb-2 text-sm font-bold">메시지방</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">{filteredRooms.map((room) => <MessageRoomItem key={room.id} room={room} currentMember={member} contactMembers={contactMembers} isSelected={selectedRoomId === room.id} isCollapsed={isSidebarCollapsed} onClick={() => setSelectedRoomId(room.id)} />)}{!isSidebarCollapsed && filteredRooms.length === 0 && <p className="p-8 text-center text-sm text-slate-500">표시할 메시지방이 없습니다.</p>}</div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col"><header className="border-b border-slate-200 px-6"><div className="flex h-20 items-center justify-between">{selectedRoom?.type === "GROUP" ? <button type="button" aria-expanded={roomManageOpen} aria-label="그룹 메시지 상세 열기" onClick={() => setRoomManageOpen((open) => !open)} className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-slate-50 active:scale-[.99]"><GroupAvatar name={displayRoomName(selectedRoom)} size="lg"/><div><h1 className="font-bold">{displayRoomName(selectedRoom)}</h1><p className="mt-1 text-xs text-slate-500">멤버 <span className="font-bold text-blue-600">{selectedRoom.memberCount}</span></p></div></button> : <div className="flex items-center gap-3"><MessageMemberAvatar name={headerProfile?.displayName ?? ""} presenceStatus={selectedRoom?.type === "SELF" ? "ONLINE" : addressBookProfile?.presenceStatus ?? "OFFLINE"} size="lg"/><div><h1 className="font-bold">{selectedRoom?.type === "SELF" && <span className="mr-1 rounded bg-slate-700 px-1 py-0.5 text-[10px] text-white">나</span>}{headerProfile?.displayName ?? "메시지"}</h1><p className="mt-1 text-xs"><span className="text-blue-600">{headerProfile?.jobGradeName}</span><span className="text-slate-500">{headerProfile?.departmentName && ` · ${headerProfile.departmentName}`}{headerProfile?.companyName && ` · ${headerProfile.companyName}`}</span></p></div></div>}</div></header><div className="flex min-h-0 flex-1"><div className="relative flex min-w-0 flex-1 flex-col">{scrollDateLabel && <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">{scrollDateLabel}</div>}
        <div ref={messageListRef} onScroll={showScrollDate} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{messages.map((message, index) => { const showDate = index === 0 || dateKey(messages[index - 1].createdAt) !== dateKey(message.createdAt); const label = formatChatDate(message.createdAt); return <Fragment key={message.id}>{showDate && <p className="my-5 text-center"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{label}</span></p>}<div data-message-date={dateKey(message.createdAt)} data-message-label={label}>{message.type === "SYSTEM" ? <p className="my-5 text-center text-xs text-slate-400">{message.content}</p> : <MessageBubble message={message} isMine={message.senderMembershipId === member?.membershipId} isDirect={selectedRoom?.type === "DIRECT"} isGroup={selectedRoom?.type === "GROUP"} onOpenReadMembers={openReadMembers} />}</div></Fragment>; })}{nextCursor && <button className="mx-auto block cursor-pointer text-xs text-blue-600 hover:underline" onClick={() => selectedRoomId && void loadMessages(selectedRoomId, nextCursor)}>이전 메시지 더 보기</button>}</div>
        <form onSubmit={submitMessage} className="m-5 rounded-2xl bg-slate-100 p-4"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="메시지를 입력해주세요. (Enter: 전송 / Shift + Enter: 줄바꿈)" className="h-24 w-full resize-none bg-transparent text-sm outline-none" /><div className="flex items-center gap-3 text-slate-600"><button type="button" aria-label="첨부" onClick={() => showToast("파일 첨부 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><Paperclip size={19} /></button><button type="button" aria-label="이미지" onClick={() => showToast("이미지 전송 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><ImagePlus size={19} /></button><button type="button" aria-label="이모지" onClick={() => showToast("이모지 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><SmilePlus size={19} /></button></div></form></div>{roomManageOpen && selectedRoom?.type === "GROUP" && accessToken && member && <GroupRoomDetail room={selectedRoom} accessToken={accessToken} currentMemberId={member.membershipId} members={contactMembers} onClose={closeRoomManageModal} onAction={async (action, targetId, name) => { if (action === "leave") await chatApi.leave(accessToken, selectedRoom.id); else if (action === "invite") await chatApi.invite(accessToken, selectedRoom.id, targetId!); else if (action === "remove") await chatApi.remove(accessToken, selectedRoom.id, targetId!); else if (action === "owner") await chatApi.transferOwner(accessToken, selectedRoom.id, targetId!); else await chatApi.rename(accessToken, selectedRoom.id, name!); setRoomManageOpen(false); await loadRooms(); if (action === "leave") setSelectedRoomId(null); }} showToast={showToast} />}</div></section>
    </main>{newRoomModalOpen && accessToken && <NewRoomModal members={contactMembers} initialMemberIds={requestedMemberIds} initialType={searchParams.get("create") === "group" ? "GROUP" : "DIRECT"} onClose={() => setNewRoomModalOpen(false)} onCreate={async (type, name, memberIds) => { const room = type === "DIRECT" ? await chatApi.createDirect(accessToken, memberIds[0]) : await chatApi.createGroup(accessToken, name, memberIds); setSelectedRoomId(room.id); setNewRoomModalOpen(false); await loadRooms(); router.push(`/message?roomId=${room.id}`); }} onSelf={async () => { const room = await chatApi.createSelf(accessToken); setSelectedRoomId(room.id); setNewRoomModalOpen(false); await loadRooms(); router.push(`/message?roomId=${room.id}`); }} showToast={showToast} />}{readModal && <ReadMemberModal modal={readModal} contactMembers={contactMembers} onClose={() => setReadModal(null)} onTab={async (read) => { if (!accessToken || !selectedRoomId) return; const members = await chatApi.readMembers(accessToken, selectedRoomId, readModal.message.id, read); setReadModal({ ...readModal, members, read }); }} />}{toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}</div>;
}

function MessageRoomItem({ room, currentMember, contactMembers, isSelected, isCollapsed, onClick }: { room: ChatRoom; currentMember: { membershipId: number; displayName: string } | null; contactMembers: AddressBookMember[]; isSelected: boolean; isCollapsed: boolean; onClick: () => void }) {
  // 1:1 방은 상대방, 나와의 채팅은 본인 프로필을 목록에 표시.
  const isSelf = room.type === "SELF";
  const isDirect = room.type === "DIRECT";
  const displayName = isSelf ? currentMember?.displayName ?? "나" : isDirect ? room.directDisplayName ?? "사용자" : room.name ?? "그룹 메시지";
  const avatarName = isSelf ? currentMember?.displayName ?? "나" : isDirect ? room.directDisplayName ?? "사용자" : room.name ?? "그룹";
  const lastMessage = room.lastMessage ?? "대화를 시작해 보세요.";
  const sentByMe = room.lastSenderMembershipId === currentMember?.membershipId;
  const presenceStatus = isSelf ? "ONLINE" : contactMembers.find((member) => member.membershipId === room.directMembershipId)?.presenceStatus ?? "OFFLINE";

  return <button type="button" title={displayName} onClick={onClick} className={`flex w-full cursor-pointer gap-3 ${isCollapsed ? "justify-center px-2 py-3" : "px-5 py-4"} text-left transition hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}>
    {room.type === "GROUP" ? <GroupAvatar name={avatarName} /> : <MessageMemberAvatar name={avatarName} presenceStatus={presenceStatus} />}
    {!isCollapsed && <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><b className="flex min-w-0 items-center gap-1 truncate">{isSelf && <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[9px] text-white">나</span>}<span className="truncate">{displayName}</span>{room.type === "GROUP" && <span className="shrink-0 text-blue-600">{room.memberCount}</span>}</b><small className="shrink-0 text-slate-500">{formatRoomTime(room.lastMessageAt)}</small></span><span className="flex items-center justify-between gap-2"><small className="flex min-w-0 items-center gap-1 truncate text-slate-500">{sentByMe && <Forward className="shrink-0 text-slate-600" size={15} strokeWidth={3} />}{lastMessage}</small>{room.unreadCount > 0 && <em className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] not-italic text-white">{room.unreadCount > 999 ? "999+" : room.unreadCount}</em>}</span></span>}
  </button>;
}

function GroupAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-10 w-10 text-xs" : "h-10 w-10 text-xs";
  // 그룹방은 프로필 원형과 별개로 우하단 배지를 항상 표시.
  return <span className={`relative flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white ${sizeClass}`}><span>{name.slice(0, 3)}</span><span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white"><UsersRound size={10} strokeWidth={3} /></span></span>;
}

function MessageMemberAvatar({ name, presenceStatus, size = "md" }: { name: string; presenceStatus: PresenceStatus; size?: "md" | "lg" }) {
  const isLarge = size === "lg";
  const badgeClassName = { ONLINE: "bg-emerald-500", OFFLINE: "bg-slate-300", AWAY: "bg-slate-500 text-white", INACTIVE: "bg-red-500 text-white" }[presenceStatus];
  // 개인 프로필은 어느 메시지 화면에서도 상태 배지를 빠뜨리지 않음.
  return <span className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-800 ${isLarge ? "h-10 w-10 text-xs" : "h-10 w-10 text-xs"}`}><span className="whitespace-nowrap">{name.slice(0, 3)}</span><span className={`absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-white ${isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} ${badgeClassName}`}>{(presenceStatus === "AWAY" || presenceStatus === "INACTIVE") && <X size={isLarge ? 10 : 9} strokeWidth={3} />}</span></span>;
}

function MessageBubble({ message, isMine, isDirect, isGroup, onOpenReadMembers }: { message: ChatMessage; isMine: boolean; isDirect: boolean; isGroup: boolean; onOpenReadMembers: (message: ChatMessage) => Promise<void> }) {
  const time = new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  // 읽음은 시간 위에만 표시하고, 그룹방은 실제 읽은 인원이 있을 때만 상세 조회를 허용.
  const readLabel = isMine && isDirect && message.unreadCount === 0 ? <span className="mb-0.5 text-blue-600">읽음</span>
    : isMine && isGroup && message.readCount > 0 ? <button className="mb-0.5 cursor-pointer text-blue-600 transition hover:underline" onClick={() => void onOpenReadMembers(message)}>‹ 읽음 {message.readCount}</button> : null;
  // 메타 영역도 말풍선에 맞닿는 방향으로 정렬해 읽음·시간이 떨어지지 않게 함.
  const meta = <div className={`flex shrink-0 flex-col pb-1 text-[11px] text-slate-400 ${isMine ? "items-end text-right" : "items-start text-left"}`}>{readLabel}<span>{time}</span></div>;
  const bubble = <div className={`relative max-w-[70%] px-4 py-3 text-sm leading-6 ${isMine ? "rounded-2xl bg-blue-100 after:absolute after:-right-2 after:bottom-2 after:border-y-[6px] after:border-l-[9px] after:border-y-transparent after:border-l-blue-100" : "rounded-2xl bg-slate-100 after:absolute after:-left-2 after:bottom-2 after:border-y-[6px] after:border-r-[9px] after:border-y-transparent after:border-r-slate-100"}`}>{message.content}</div>;
  // 내 말풍선은 시간→말풍선, 상대 말풍선은 말풍선→시간 순서.
  return <div className={`mb-4 flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>{isMine ? <>{meta}{bubble}</> : <>{bubble}{meta}</>}</div>;
}

function NewRoomModal({ members, initialMemberIds, initialType, onClose, onCreate, onSelf, showToast }: { members: AddressBookMember[]; initialMemberIds: number[]; initialType: "DIRECT" | "GROUP"; onClose: () => void; onCreate: (type: "DIRECT" | "GROUP", name: string, memberIds: number[]) => Promise<void>; onSelf: () => Promise<void>; showToast: (message: string) => void }) {
  const [type, setType] = useState<"DIRECT" | "GROUP">(initialType);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(initialMemberIds);
  const [keyword, setKeyword] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (event.target === ref.current) onClose(); }; const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("mousedown", close); document.addEventListener("keydown", key); return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); }; }, [onClose]);
  const visibleMembers = members.filter((member) => `${member.displayName} ${member.email}`.toLowerCase().includes(keyword.toLowerCase()));
  const toggleMember = (membershipId: number) => setSelectedIds((current) => type === "DIRECT" ? [membershipId] : current.includes(membershipId) ? current.filter((id) => id !== membershipId) : [...current, membershipId]);
  const submit = async () => { if (type === "DIRECT" && selectedIds.length !== 1) { showToast("1:1 메시지 상대를 한 명 선택해 주세요."); return; } if (type === "GROUP" && !name.trim()) { showToast("그룹명을 입력해 주세요."); return; } if (type === "GROUP" && selectedIds.length < 2) { showToast("그룹 메시지는 나를 포함해 3명 이상이어야 합니다."); return; } try { await onCreate(type, name.trim(), selectedIds); } catch (error) { showToast(error instanceof Error ? error.message : "메시지방을 만들지 못했습니다."); } };
  return <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4"><section className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">새 메시지</h2><button aria-label="닫기" onClick={onClose} className="cursor-pointer p-1 text-slate-500 hover:text-slate-900"><X /></button></div><button onClick={() => void onSelf()} className="mt-4 w-full cursor-pointer rounded-lg border border-slate-200 py-2 text-sm transition hover:bg-slate-50">나와의 채팅</button><div className="mt-5 flex border-b border-slate-200"><button onClick={() => { setType("DIRECT"); setSelectedIds([]); }} className={`cursor-pointer px-4 py-2 text-sm ${type === "DIRECT" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-500"}`}>1:1 메시지</button><button onClick={() => { setType("GROUP"); setSelectedIds([]); }} className={`cursor-pointer px-4 py-2 text-sm ${type === "GROUP" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-500"}`}>그룹 메시지</button></div>{type === "GROUP" && <label className="mt-4 block text-sm font-medium">그룹명<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" placeholder="그룹명을 입력하세요" /></label>}<label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={17}/><input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="w-full text-sm outline-none" placeholder="구성원 검색" /></label><div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200">{visibleMembers.map((member) => <button key={member.membershipId} onClick={() => toggleMember(member.membershipId)} className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${selectedIds.includes(member.membershipId) ? "bg-blue-50" : ""}`}><span className="flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold">{member.displayName.slice(0,3)}</span><span className="flex-1"><b className="block text-sm">{member.displayName}</b><small className="text-slate-500">{member.departmentName ?? "부서 미지정"} · {member.email}</small></span><span className={`h-5 w-5 rounded-md border ${selectedIds.includes(member.membershipId) ? "border-blue-600 bg-blue-600" : "border-slate-300"}`} /></button>)}</div><p className="mt-2 text-xs text-slate-500">{type === "GROUP" ? `선택 ${selectedIds.length}명 + 나` : `선택 ${selectedIds.length}명`}</p><button onClick={() => void submit()} className="mt-5 h-11 w-full cursor-pointer rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[.98]">메시지방 만들기</button></section></div>;
}

function GroupRoomDetail({ room, accessToken, currentMemberId, members, onClose, onAction, showToast }: { room: ChatRoom; accessToken: string; currentMemberId: number; members: AddressBookMember[]; onClose: () => void; onAction: (action: "leave" | "invite" | "remove" | "owner" | "rename", targetId?: number, name?: string) => Promise<void>; showToast: (message: string) => void }) {
  const [name, setName] = useState(room.name ?? "");
  const [inviteId, setInviteId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<ChatMemberProfile[]>([]);
  const owner = room.ownerMembershipId === currentMemberId;
  const inviteCandidates = members.filter((member) => !participants.some((participant) => participant.membershipId === member.membershipId));
  useEffect(() => {
    let active = true;
    const closeByEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeByEscape);
    void chatApi.detail(accessToken, room.id).then((detail) => { if (active) setParticipants(detail.members); }).catch((error: Error) => showToast(error.message));
    return () => { active = false; document.removeEventListener("keydown", closeByEscape); };
  }, [accessToken, onClose, room.id, showToast]);
  const run = async (action: "leave" | "invite" | "remove" | "owner" | "rename", targetId?: number) => { try { if (action === "rename" && !name.trim()) { showToast("그룹명을 입력해 주세요."); return; } if (action === "invite" && !inviteId) { showToast("초대할 구성원을 선택해 주세요."); return; } await onAction(action, targetId ?? inviteId ?? undefined, name); } catch (error) { showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); } };
  return <aside className="h-full w-[min(420px,40vw)] shrink-0 animate-in slide-in-from-right overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><GroupAvatar name={room.name ?? "그룹"} size="lg"/><div><b className="block">{room.name}</b><p className="mt-1 text-sm text-slate-500">멤버 <span className="font-bold text-blue-600">{participants.length || room.memberCount}</span></p></div></div><button aria-label="그룹 메시지 상세 닫기" onClick={onClose} className="cursor-pointer rounded p-1 text-slate-500 transition hover:bg-slate-100"><X/></button></div>{owner && <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4"><label className="text-sm font-medium">그룹명<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"/></label><button onClick={() => void run("rename")} className="h-9 cursor-pointer rounded-lg border border-blue-200 px-3 text-sm text-blue-700 transition hover:bg-blue-50">변경</button><label className="text-sm font-medium">구성원 초대<select value={inviteId ?? ""} onChange={(event) => setInviteId(Number(event.target.value) || null)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3"><option value="">구성원을 선택하세요</option>{inviteCandidates.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.displayName} · {member.departmentName ?? "미지정"}</option>)}</select></label><button onClick={() => void run("invite")} className="h-9 cursor-pointer rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition hover:bg-blue-700">초대</button></div>}<section className="mt-4 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold">멤버 <span className="text-blue-600">({participants.length || room.memberCount})</span></h3><div className="mt-2 max-h-[calc(100vh-25rem)] overflow-y-auto">{participants.map((participant) => { const isRoomOwner = participant.membershipId === room.ownerMembershipId; const isMe = participant.membershipId === currentMemberId; const presenceStatus = isMe ? "ONLINE" : members.find((member) => member.membershipId === participant.membershipId)?.presenceStatus ?? "OFFLINE"; return <div key={participant.membershipId} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><MessageMemberAvatar name={participant.displayName} presenceStatus={presenceStatus}/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{participant.displayName}{isMe ? " (나)" : ""}</b><small className="block truncate text-slate-500">{[participant.jobGradeName, participant.departmentName].filter(Boolean).join(" · ")}</small></span>{isRoomOwner && <em className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] not-italic text-blue-600">방장</em>}{owner && !isMe && <span className="flex shrink-0 gap-1"><button onClick={() => void run("owner", participant.membershipId)} className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[11px] transition hover:border-blue-300 hover:bg-blue-50">위임</button><button onClick={() => void run("remove", participant.membershipId)} className="cursor-pointer rounded border border-red-100 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50">내보내기</button></span>}</div>; })}{participants.length === 0 && <p className="p-3 text-center text-sm text-slate-500">참여자를 불러오는 중입니다.</p>}</div></section><button onClick={() => void run("leave")} className="mt-4 cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 active:scale-[.98]">채팅방 나가기</button></aside>;
}

function ReadMemberModal({ modal, contactMembers, onClose, onTab }: { modal: { message: ChatMessage; members: ChatReadMember[]; read: boolean }; contactMembers: AddressBookMember[]; onClose: () => void; onTab: (read: boolean) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const handler = (event: MouseEvent) => { if (event.target === ref.current) onClose(); }; const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("mousedown", handler); document.addEventListener("keydown", key); return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", key); }; }, [onClose]);
  return <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">읽은 멤버 ({modal.members.length})</h2><button className="cursor-pointer p-1" onClick={onClose}><X /></button></div><div className="mt-4 flex border-b border-slate-200"><button className={`cursor-pointer px-4 py-2 text-sm ${modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`} onClick={() => void onTab(true)}>읽음</button><button className={`cursor-pointer px-4 py-2 text-sm ${!modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`} onClick={() => void onTab(false)}>안 읽음</button></div><div className="mt-3 max-h-[420px] overflow-y-auto">{modal.members.map((member) => <button key={member.membershipId} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"><MessageMemberAvatar name={member.displayName} presenceStatus={contactMembers.find((target) => target.membershipId === member.membershipId)?.presenceStatus ?? "OFFLINE"}/><span><b className="block">{member.displayName}</b><small className="text-slate-500">{[member.jobGrade, member.departmentName].filter(Boolean).join("/")}</small></span><small className="ml-auto text-blue-600">{modal.read ? "읽음" : "안 읽음"}</small></button>)}</div></section></div>;
}
