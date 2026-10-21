"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { FavoriteButton } from "@/components/address-book/favorite-button";
import { Toast } from "@/components/common/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { addressBookApi, type AddressBookMember, type AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { BookUser, Building2, CalendarDays, Check, ExternalLink, Mail, MessageCircle, Search, Star, UsersRound, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";

type ResultTab = "all" | "member" | "organizationGroup";

export default function AddressBookSearchPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-100" />}><AddressBookSearchContent /></Suspense>;
}

function AddressBookSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, member, status, logout } = useAuth();
  const { toast, showToast, dismissToast, resetToast } = useToast();
  const requestedKeyword = searchParams.get("keyword")?.trim() ?? "";
  const [keyword, setKeyword] = useState(requestedKeyword);
  const [members, setMembers] = useState<AddressBookMember[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedMember, setSelectedMember] = useState<AddressBookMemberDetail | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [tab, setTab] = useState<ResultTab>("all");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadResults = useCallback(async () => {
    if (!accessToken || !requestedKeyword) {
      setMembers([]);
      setTotalElements(0);
      return;
    }
    const parameters = new URLSearchParams({ keyword: requestedKeyword, page: "0", size: "100", sort: "name", direction: "asc" });
    const result = await addressBookApi.member(accessToken, parameters);
    setMembers(result.content);
    setTotalElements(result.totalElements);
  }, [accessToken, requestedKeyword]);

  useEffect(() => {
    // URL 검색어가 바뀌면 이전 화면 선택 상태를 비동기로 비움.
    void Promise.resolve().then(() => {
      setKeyword(requestedKeyword);
      setSelectedMember(null);
      setSelectedMemberIds([]);
    });
  }, [requestedKeyword]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (!isLoggingOut) markAuthenticationRequired();
    router.replace("/");
  }, [isLoggingOut, router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // 렌더링 이후에 조회를 시작해 Effect 안의 동기 상태 변경을 피함.
    void Promise.resolve().then(loadResults).catch((error: unknown) => showToast(error instanceof Error ? error.message : "검색 결과를 불러오지 못했습니다."));
  }, [loadResults, showToast, status]);

  const submitSearch = () => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;
    router.replace(`/addressBook/search?keyword=${encodeURIComponent(normalizedKeyword)}`);
  };

  const selectMember = async (target: AddressBookMember) => {
    if (!accessToken) return;
    try {
      setSelectedMember(await addressBookApi.memberDetail(accessToken, target.membershipId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "구성원 정보를 불러오지 못했습니다.");
    }
  };

  const toggleFavorite = async (target: AddressBookMember) => {
    if (!accessToken) return;
    const nextFavorite = !target.favorite;
    setMembers((currentMembers) => currentMembers.map((current) => current.membershipId === target.membershipId ? { ...current, favorite: nextFavorite } : current));
    if (selectedMember?.membershipId === target.membershipId) setSelectedMember({ ...selectedMember, favorite: nextFavorite });
    try {
      if (target.favorite) await addressBookApi.deleteFavorite(accessToken, target.membershipId);
      else await addressBookApi.createFavorite(accessToken, target.membershipId);
    } catch (error) {
      setMembers((currentMembers) => currentMembers.map((current) => current.membershipId === target.membershipId ? { ...current, favorite: target.favorite } : current));
      if (selectedMember?.membershipId === target.membershipId) setSelectedMember({ ...selectedMember, favorite: target.favorite });
      showToast(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했습니다.");
    }
  };

  const toggleSelection = (membershipId: number) => setSelectedMemberIds((currentIds) => currentIds.includes(membershipId) ? currentIds.filter((id) => id !== membershipId) : [...currentIds, membershipId]);
  const toggleAll = () => setSelectedMemberIds((currentIds) => currentIds.length === members.length ? [] : members.map((target) => target.membershipId));
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsProfileMenuOpen(false);
    setSelectedMember(null);
    resetToast();
    await logout();
    router.replace("/");
  };

  if (status !== "authenticated" || !member) return <div className="min-h-screen bg-slate-100" />;

  return <div className="min-h-screen bg-white text-slate-900">
    <GlobalHeader role={member.role} pageTitle="주소록" isAuthenticated profileName={member.displayName} profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`} isProfileMenuOpen={isProfileMenuOpen} onHomeAction={() => router.push("/home")} onServiceAction={(label) => ["주소록", "조직도"].includes(label) ? router.push("/addressBook") : showToast(`${label} 기능은 준비 중입니다.`)} onProfileAction={() => setIsProfileMenuOpen((open) => !open)} onCloseProfileMenu={() => setIsProfileMenuOpen(false)} onLogout={() => void handleLogout()} onSidebarToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)} isSidebarCollapsed={isSidebarCollapsed} headerContent={<SearchBox keyword={keyword} onChange={setKeyword} onSubmit={submitSearch} />} />
    <main className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className={`shrink-0 border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ${isSidebarCollapsed ? "w-20 p-2" : "w-64 p-3"}`}>
        {isSidebarCollapsed ? <div className="flex flex-col items-center gap-4 pt-2"><SidebarButton label="주소록" icon={<BookUser size={20} />} onClick={() => router.push("/addressBook")} /><SidebarButton label="조직도" icon={<Building2 size={20} />} onClick={() => router.push("/addressBook")} /><SidebarButton label="그룹" icon={<UsersRound size={20} />} onClick={() => showToast("그룹 기능은 준비 중입니다.")} /></div> : <><button className="mb-4 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]" onClick={() => showToast("그룹 생성 기능은 준비 중입니다.")}>새로 만들기</button><SidebarButton label="즐겨찾기" icon={<Star size={19} />} onClick={() => router.push("/addressBook")} /><SidebarButton label="조직도" icon={<Building2 size={19} />} onClick={() => router.push("/addressBook")} /><SidebarButton label="그룹" icon={<UsersRound size={19} />} onClick={() => showToast("그룹 기능은 준비 중입니다.")} /></>}
      </aside>
      <section className="min-w-0 flex-1 p-6">
        <h1 className="text-xl font-bold">검색 결과 <span className="text-blue-600">{totalElements}</span></h1>
        <p className="mt-1 text-sm text-slate-500">“{requestedKeyword || "검색어 없음"}” · 이름, 이메일, 연락처에서 검색</p>
        <div className="mt-6 flex h-9 items-center gap-2"><Checkbox label="전체 검색 결과 선택" checked={members.length > 0 && selectedMemberIds.length === members.length} onChange={toggleAll} /><button disabled={!selectedMemberIds.length} className="rounded-md border border-slate-200 px-4 py-2 text-sm transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:opacity-40" onClick={() => showToast("메일 기능은 준비 중입니다.")}>메일</button><button disabled={!selectedMemberIds.length} className="rounded-md border border-slate-200 px-4 py-2 text-sm transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:opacity-40" onClick={() => router.push("/message")}>메시지</button></div>
        <div className="mt-4 flex gap-5 border-b border-slate-200"><Tab label="전체" active={tab === "all"} onClick={() => setTab("all")} /><Tab label="구성원" active={tab === "member"} onClick={() => setTab("member")} /><Tab label="조직·그룹" active={tab === "organizationGroup"} onClick={() => setTab("organizationGroup")} /></div>
        {tab === "organizationGroup" ? <div className="py-24 text-center text-sm text-slate-500">그룹 채팅 기반 검색은 준비 중입니다.</div> : <div className="mt-0 flex min-h-[calc(100vh-17rem)] border-b border-slate-200"><div className="min-w-0 flex-1 overflow-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="border-y border-slate-200 text-slate-700"><tr><th className="w-11 px-3 py-3" />{["이름", "직책/직급", "부서", "소속", "이메일", "전화번호"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{members.map((target) => <tr key={target.membershipId} className={`cursor-pointer border-b border-slate-100 transition hover:bg-blue-50 ${selectedMember?.membershipId === target.membershipId ? "bg-blue-50" : ""}`} onClick={() => void selectMember(target)}><td className="px-3 py-3"><span onClick={(event) => event.stopPropagation()}><Checkbox label={`${target.displayName} 선택`} checked={selectedMemberIds.includes(target.membershipId)} onChange={() => toggleSelection(target.membershipId)} /></span></td><td className="px-4 py-3"><div className="flex items-center gap-2"><span onClick={(event) => event.stopPropagation()}><FavoriteButton active={target.favorite} onClick={() => void toggleFavorite(target)} /></span><Avatar member={target} /><b>{target.displayName}</b></div></td><td className="px-4 py-3">{[target.jobTitle, target.jobGradeName].filter(Boolean).join(" / ") || "-"}</td><td className="px-4 py-3">{target.departmentName ?? "-"}</td><td className="px-4 py-3">{target.companyName}</td><td className="px-4 py-3">{target.email}</td><td className="px-4 py-3">{target.phoneNumber ?? "-"}</td></tr>)}</tbody></table>{!members.length && <p className="py-24 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>}</div>{selectedMember && <MemberPanel member={selectedMember} onClose={() => setSelectedMember(null)} onToggleFavorite={() => void toggleFavorite(selectedMember)} showToast={showToast} />}</div>}
      </section>
    </main>
    {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}
  </div>;
}

function SearchBox({ keyword, onChange, onSubmit }: { keyword: string; onChange: (value: string) => void; onSubmit: () => void }) { return <form className="mx-auto flex h-10 w-full max-w-[500px] items-center gap-2 rounded-full bg-slate-100 px-4 focus-within:ring-2 focus-within:ring-blue-500" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><Search size={18} className="text-slate-500" /><input className="w-full bg-transparent text-sm text-slate-800 outline-none" value={keyword} onChange={(event) => onChange(event.target.value)} placeholder="이름, 이메일, 연락처 검색" />{keyword && <button type="button" aria-label="검색어 지우기" className="rounded-full bg-slate-400 p-0.5 text-white transition hover:scale-110" onClick={() => onChange("")}><X size={13} /></button>}</form>; }
function SidebarButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) { return <button className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-blue-600" onClick={onClick}>{icon}<span>{label}</span></button>; }
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button className={`cursor-pointer border-b-2 px-1 pb-3 text-sm transition ${active ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`} onClick={onClick}>{label}</button>; }
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <button type="button" role="checkbox" aria-label={label} aria-checked={checked} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md" onClick={onChange}><span className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${checked ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white hover:border-blue-400"}`}>{checked && <Check size={14} strokeWidth={3} />}</span></button>; }
function Avatar({ member }: { member: AddressBookMember | AddressBookMemberDetail }) { return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold">{member.displayName.slice(0, 3)}</span>; }
function MemberPanel({ member, onClose, onToggleFavorite, showToast }: { member: AddressBookMemberDetail; onClose: () => void; onToggleFavorite: () => void; showToast: (message: string) => void }) { return <aside className="relative w-80 shrink-0 border-l border-slate-200 bg-white p-4"><div className="flex justify-end gap-2"><button aria-label="프로필 상세 열기" className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90" onClick={() => showToast("프로필 상세 기능은 준비 중입니다.")}><ExternalLink size={20} /></button><button aria-label="상세 패널 닫기" className="cursor-pointer rounded-md p-0 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90" onClick={onClose}><X /></button></div><div className="mt-4 flex items-center gap-3"><Avatar member={member} /><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">{member.displayName}</h2><p className="text-sm text-slate-500">{[member.jobTitle, member.jobGradeName].filter(Boolean).join(" / ") || "직급 미지정"}</p></div></div><span className="absolute right-4 top-[4.25rem]"><FavoriteButton active={member.favorite} onClick={onToggleFavorite} size="panel" /></span><div className="mt-6 grid grid-cols-3 text-center text-xs text-blue-600"><PanelAction icon={<MessageCircle size={20} />} label="메시지" onClick={() => showToast("메시지 기능은 준비 중입니다.")} /><PanelAction icon={<Mail size={20} />} label="메일" onClick={() => showToast("메일 기능은 준비 중입니다.")} /><PanelAction icon={<CalendarDays size={20} />} label="캘린더" onClick={() => showToast("캘린더 기능은 준비 중입니다.")} /></div><dl className="mt-6 space-y-4 text-sm"><Info label="소속" value={member.companyName} strong /><Info label="" value={member.departmentName ?? "부서 미지정"} /><Info label="전화" value={member.phoneNumber ?? "-"} /><Info label="이메일" value={member.email} /><Info label="입사일" value={member.hiredAt ?? "-"} /></dl></aside>; }
function PanelAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) { return <button className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95" onClick={onClick}>{icon}<span className="mt-1 block">{label}</span></button>; }
function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div><dt className="mb-1 text-xs text-slate-500">{label}</dt><dd className={strong ? "font-bold" : "font-medium"}>{value}</dd></div>; }
