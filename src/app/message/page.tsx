"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { chatApi, type ChatMessage, type ChatReadMember, type ChatRoom } from "@/lib/api/chat-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, Paperclip, Search, SmilePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

export default function MessagePage() {
  const router = useRouter();
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadRooms = useCallback(async () => {
    if (!accessToken) return;
    const result = await chatApi.rooms(accessToken);
    setRooms(result);
    setSelectedRoomId((current) => current ?? result[0]?.id ?? null);
  }, [accessToken]);

  const loadMessages = useCallback(async (roomId: number, cursor?: number) => {
    if (!accessToken) return;
    const result = await chatApi.messages(accessToken, roomId, cursor);
    setMessages((current) => cursor ? [...result.messages, ...current] : result.messages);
    setNextCursor(result.nextCursor);
  }, [accessToken]);

  useEffect(() => {
    if (status === "unauthenticated") { markAuthenticationRequired(); router.replace("/"); return; }
    if (status === "authenticated") void Promise.resolve().then(loadRooms).catch((error: Error) => showToast(error.message));
  }, [loadRooms, router, showToast, status]);

  useEffect(() => {
    if (selectedRoomId) void Promise.resolve().then(() => loadMessages(selectedRoomId)).catch((error: Error) => showToast(error.message));
  }, [loadMessages, selectedRoomId, showToast]);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const filteredRooms = rooms.filter((room) => (room.name ?? "1:1 채팅").toLowerCase().includes(search.toLowerCase()));
  const displayRoomName = (room: ChatRoom) => room.name ?? "1:1 채팅";

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!accessToken || !selectedRoomId || !input.trim()) return;
    try {
      const message = await chatApi.send(accessToken, selectedRoomId, input.trim());
      setMessages((current) => [...current, message]); setInput(""); inputRef.current?.focus(); void loadRooms();
    } catch (error) { showToast(error instanceof Error ? error.message : "메시지를 보내지 못했습니다."); }
  };

  const openReadMembers = async (message: ChatMessage) => {
    if (!accessToken || !selectedRoomId || message.type !== "TEXT") return;
    try { const members = await chatApi.readMembers(accessToken, selectedRoomId, message.id, true); setReadModal({ message, members, read: true }); }
    catch (error) { showToast(error instanceof Error ? error.message : "읽음 멤버를 조회하지 못했습니다."); }
  };

  return <div className="min-h-screen bg-white text-slate-900">
    {member && <GlobalHeader role={member.role} pageTitle="메시지" isAuthenticated profileName={member.displayName} profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`} isProfileMenuOpen={isProfileOpen} onHomeAction={() => router.push("/home")} onServiceAction={(label) => label === "주소록" || label === "조직도" ? router.push("/addressBook") : label === "메시지" ? router.push("/message") : showToast(`${label} 기능은 준비 중입니다.`)} onProfileAction={() => setIsProfileOpen((open) => !open)} onCloseProfileMenu={() => setIsProfileOpen(false)} onLogout={() => void logout().then(() => router.replace("/"))} headerContent={<label className="mx-auto flex h-10 w-full max-w-[480px] items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-500"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="채팅방, 대화 상대 검색" className="w-full bg-transparent text-sm outline-none" /></label>} />}
    <main className="flex h-[calc(100vh-3.5rem)] min-h-[620px]">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <button onClick={() => showToast("채팅방 만들기 기능은 준비 중입니다.")} className="m-3 h-11 cursor-pointer rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[.98]">새로 만들기</button>
        <p className="px-5 pb-2 text-sm font-bold">메시지방</p>
        <div className="min-h-0 flex-1 overflow-y-auto">{filteredRooms.map((room) => <button key={room.id} onClick={() => setSelectedRoomId(room.id)} className={`flex w-full cursor-pointer gap-3 px-5 py-4 text-left transition hover:bg-blue-50 ${selectedRoomId === room.id ? "bg-blue-100" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">{displayRoomName(room).slice(0, 3)}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><b className="truncate">{displayRoomName(room)}{room.type === "GROUP" ? ` ${room.memberCount}` : ""}</b><small className="shrink-0 text-slate-500">{room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}</small></span><span className="flex items-center justify-between gap-2"><small className="truncate text-slate-500">{room.lastMessage ?? "대화를 시작해 보세요."}</small>{room.unreadCount > 0 && <em className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] not-italic text-white">{room.unreadCount > 999 ? "999+" : room.unreadCount}</em>}</span></span></button>)}{filteredRooms.length === 0 && <p className="p-8 text-center text-sm text-slate-500">표시할 메시지방이 없습니다.</p>}</div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col"><header className="flex h-20 items-center border-b border-slate-200 px-6"><div><h1 className="font-bold">{selectedRoom ? displayRoomName(selectedRoom) : "메시지"}</h1><p className="mt-1 text-xs text-slate-500">{selectedRoom?.type === "GROUP" ? `멤버 ${selectedRoom.memberCount}` : "1:1 대화"}</p></div></header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{messages.map((message) => message.type === "SYSTEM" ? <p key={message.id} className="my-5 text-center text-xs text-slate-400">{message.content}</p> : <div key={message.id} className={`mb-4 flex ${message.senderMembershipId === member?.membershipId ? "justify-end" : "justify-start"}`}><div className={`max-w-[70%] ${message.senderMembershipId === member?.membershipId ? "text-right" : ""}`}><p className="mb-1 text-xs text-slate-500">{message.senderMembershipId === member?.membershipId ? "나" : message.senderName}</p><div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.senderMembershipId === member?.membershipId ? "bg-blue-100" : "bg-slate-100"}`}>{message.content}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400"><span>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{selectedRoom?.type === "GROUP" && message.senderMembershipId === member?.membershipId && <button className="cursor-pointer text-blue-600 hover:underline" onClick={() => void openReadMembers(message)}>읽음 {message.unreadCount}</button>}</div></div></div>)}{nextCursor && <button className="mx-auto block cursor-pointer text-xs text-blue-600 hover:underline" onClick={() => selectedRoomId && void loadMessages(selectedRoomId, nextCursor)}>이전 메시지 더 보기</button>}</div>
        <form onSubmit={submitMessage} className="m-5 rounded-2xl bg-slate-100 p-4"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="메시지를 입력해주세요. (Enter: 전송 / Shift + Enter: 줄바꿈)" className="h-24 w-full resize-none bg-transparent text-sm outline-none" /><div className="flex items-center gap-3 text-slate-600"><button type="button" aria-label="첨부" onClick={() => showToast("파일 첨부 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><Paperclip size={19} /></button><button type="button" aria-label="이미지" onClick={() => showToast("이미지 전송 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><ImagePlus size={19} /></button><button type="button" aria-label="이모지" onClick={() => showToast("이모지 기능은 준비 중입니다.")} className="cursor-pointer transition hover:text-blue-600"><SmilePlus size={19} /></button></div></form></section>
    </main>{readModal && <ReadMemberModal modal={readModal} onClose={() => setReadModal(null)} onTab={async (read) => { if (!accessToken || !selectedRoomId) return; const members = await chatApi.readMembers(accessToken, selectedRoomId, readModal.message.id, read); setReadModal({ ...readModal, members, read }); }} />}{toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}</div>;
}

function ReadMemberModal({ modal, onClose, onTab }: { modal: { message: ChatMessage; members: ChatReadMember[]; read: boolean }; onClose: () => void; onTab: (read: boolean) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const handler = (event: MouseEvent) => { if (event.target === ref.current) onClose(); }; const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("mousedown", handler); document.addEventListener("keydown", key); return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", key); }; }, [onClose]);
  return <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">읽은 멤버 ({modal.members.length})</h2><button className="cursor-pointer p-1" onClick={onClose}><X /></button></div><div className="mt-4 flex border-b border-slate-200"><button className={`cursor-pointer px-4 py-2 text-sm ${modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`} onClick={() => void onTab(true)}>읽음</button><button className={`cursor-pointer px-4 py-2 text-sm ${!modal.read ? "border-b-2 border-blue-600 text-blue-600" : ""}`} onClick={() => void onTab(false)}>안 읽음</button></div><div className="mt-3 max-h-[420px] overflow-y-auto">{modal.members.map((member) => <button key={member.membershipId} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold">{member.displayName.slice(0, 3)}</span><span><b className="block">{member.displayName}</b><small className="text-slate-500">{[member.jobGrade, member.departmentName].filter(Boolean).join("/")}</small></span><small className="ml-auto text-blue-600">{modal.read ? "읽음" : "안 읽음"}</small></button>)}</div></section></div>;
}
