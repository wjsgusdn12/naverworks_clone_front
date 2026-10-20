"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { addressBookApi, type AddressBookMember, type AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { Building2, ChevronDown, Mail, MessageCircle, Search, Star, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AddressBookView = "favorite" | "group" | "company" | "department";

const statusClassName = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-slate-300",
  AWAY: "bg-slate-500 text-white",
  INACTIVE: "bg-red-500 text-white",
} as const;

export default function AddressBookPage() {
  const router = useRouter();
  const { accessToken, member, status, logout } = useAuth();
  const { toast, showToast, dismissToast } = useToast();
  const [view, setView] = useState<AddressBookView>("company");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [departments, setDepartments] = useState<{ id: number; name: string; enabled: boolean }[]>([]);
  const [members, setMembers] = useState<AddressBookMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<AddressBookMemberDetail | null>(null);
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState("asc");

  const loadMembers = useCallback(async () => {
    if (!accessToken) return;
    const parameters = new URLSearchParams({ page: "0", size: "50", sort, direction });
    if (keyword.trim()) parameters.set("keyword", keyword.trim());
    if (view === "department" && departmentId) parameters.set("departmentId", String(departmentId));
    if (view === "favorite") parameters.set("favoriteOnly", "true");
    const result = await addressBookApi.member(accessToken, parameters);
    setMembers(result.content);
  }, [accessToken, departmentId, direction, keyword, sort, view]);

  useEffect(() => {
    if (status === "unauthenticated") {
      markAuthenticationRequired();
      router.replace("/");
      return;
    }
    if (!accessToken) return;
    void (async () => {
      try {
        const organization = await addressBookApi.organization(accessToken);
        setCompanyName(organization.companyName);
        setDepartments(organization.departments);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
      }
    })();
  }, [accessToken, router, showToast, status]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || view === "group") return;
    // 렌더링 직후 비동기로 목록을 갱신해 Effect 안의 동기 상태 변경을 피함.
    void Promise.resolve().then(loadMembers).catch((error: unknown) => {
      showToast(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
    });
  }, [accessToken, loadMembers, showToast, status, view]);

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
    const previousMembers = members;
    const nextFavorite = !target.favorite;
    // 서버 응답을 기다리지 않고 별표를 즉시 바꿔 클릭 반응을 보장.
    setMembers((currentMembers) => currentMembers
      .map((currentMember) => currentMember.membershipId === target.membershipId
        ? { ...currentMember, favorite: nextFavorite }
        : currentMember)
      .filter((currentMember) => view !== "favorite" || currentMember.favorite));
    if (selectedMember?.membershipId === target.membershipId) {
      setSelectedMember({ ...selectedMember, favorite: nextFavorite });
    }
    try {
      if (target.favorite) await addressBookApi.deleteFavorite(accessToken, target.membershipId);
      else await addressBookApi.createFavorite(accessToken, target.membershipId);
    } catch (error) {
      // 저장 실패 시에만 클릭 직전 목록으로 되돌려 화면과 DB 상태를 맞춤.
      setMembers(previousMembers);
      if (selectedMember?.membershipId === target.membershipId) setSelectedMember({ ...selectedMember, favorite: target.favorite });
      showToast(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했습니다.");
    }
  };

  const selectSort = (nextSort: string) => {
    if (nextSort === sort) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(nextSort);
      setDirection("asc");
    }
  };

  if (status !== "authenticated" || !member) return <div className="min-h-screen bg-slate-100" />;

  const sectionTitle = view === "favorite" ? "즐겨찾기" : view === "group" ? "그룹" : companyName || "주소록";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlobalHeader role={member.role} isAuthenticated profileName={member.displayName} profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`} onHomeAction={() => router.push("/home")} onServiceAction={(label) => ["주소록", "조직도"].includes(label) ? router.push("/addressBook") : showToast(`${label} 기능은 준비 중입니다.`)} onProfileAction={() => showToast("내 프로필 기능은 준비 중입니다.")} onLogout={() => void logout().then(() => router.replace("/"))} />
      <main className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
          <button className="mb-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800" onClick={() => showToast("그룹 생성 기능은 준비 중입니다.")}>새로 만들기 <ChevronDown className="ml-1" size={15} /></button>
          <div className="grid grid-cols-2 border-b border-slate-200 pb-3 text-sm">
            <button className={`cursor-pointer rounded-md py-2 ${view === "favorite" ? "text-blue-600" : "text-slate-600"}`} onClick={() => { setView("favorite"); setDepartmentId(null); }}><Star className="mx-auto mb-1" size={18} />즐겨찾기</button>
            <button className={`cursor-pointer rounded-md py-2 ${view === "group" ? "text-blue-600" : "text-slate-600"}`} onClick={() => { setView("group"); setDepartmentId(null); }}><UsersRound className="mx-auto mb-1" size={18} />그룹</button>
          </div>
          <div className="mt-4 text-sm"><p className="mb-2 font-medium text-slate-600">⌄ 조직도</p>
            <button className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left ${view === "company" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"}`} onClick={() => { setView("company"); setDepartmentId(null); }}><Building2 size={17} />{companyName || "회사"}</button>
            {departments.map((department) => <button key={department.id} className={`ml-5 flex w-[calc(100%-1.25rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left ${view === "department" && departmentId === department.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"}`} onClick={() => { setView("department"); setDepartmentId(department.id); }}><UsersRound size={16} />{department.name}</button>)}
          </div>
        </aside>
        <section className="min-w-0 flex-1 p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><h1 className="text-xl font-bold">{sectionTitle}</h1><label className="flex h-10 w-full max-w-md items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-500"><Search size={18} /><input className="w-full bg-transparent text-sm outline-none" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadMembers()} placeholder="연락처, 이메일 검색" /></label></div>
          {view === "group" ? <GroupPlaceholder showToast={showToast} /> : <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full min-w-[850px] border-collapse text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>{[["name", "이름"], ["jobGrade", "직책/직급"], ["department", "부서"], ["company", "소속"], ["email", "이메일"], ["phone", "전화번호"]].map(([key, label]) => <th key={key} className="px-4 py-3 font-semibold"><button className="cursor-pointer hover:text-blue-600" onClick={() => selectSort(key)}>{label}{sort === key ? (direction === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody>{members.map((target) => <tr key={target.membershipId} className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50" onClick={() => void selectMember(target)}><td className="px-4 py-3"><button aria-label="즐겨찾기 변경" className="mr-2 cursor-pointer align-middle text-amber-400" onClick={(event) => { event.stopPropagation(); void toggleFavorite(target); }}><Star size={17} fill={target.favorite ? "currentColor" : "none"} /></button><span className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full ${statusClassName[target.presenceStatus]}`}>{(target.presenceStatus === "AWAY" || target.presenceStatus === "INACTIVE") && <X size={11} />}</span><b>{target.displayName}</b></td><td className="px-4 py-3">{[target.jobTitle, target.jobGradeName].filter(Boolean).join(" / ") || "-"}</td><td className="px-4 py-3">{target.departmentName ?? "-"}</td><td className="px-4 py-3">{target.companyName}</td><td className="px-4 py-3">{target.email}</td><td className="px-4 py-3">{target.phoneNumber ?? "-"}</td></tr>)}</tbody></table>{members.length === 0 && <p className="p-12 text-center text-sm text-slate-500">표시할 구성원이 없습니다.</p>}</div>}
        </section>
        {selectedMember && <MemberPanel member={selectedMember} onClose={() => setSelectedMember(null)} showToast={showToast} />}
      </main>
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}
    </div>
  );
}

function GroupPlaceholder({ showToast }: { showToast: (message: string) => void }) {
  const [tab, setTab] = useState("전체");
  return <div><div className="mb-4 flex gap-5 border-b border-slate-200">{["전체", "내가 속한 그룹", "내가 마스터인 그룹"].map((label) => <button key={label} className={`cursor-pointer border-b-2 px-1 pb-3 text-sm ${tab === label ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500"}`} onClick={() => setTab(label)}>{label}</button>)}</div><div className="rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">주소록 그룹 목록은 준비 중입니다.<button className="ml-2 cursor-pointer font-semibold text-blue-600 hover:underline" onClick={() => showToast("그룹 생성 기능은 준비 중입니다.")}>그룹 만들기</button></div></div>;
}

function MemberPanel({ member, onClose, showToast }: { member: AddressBookMemberDetail; onClose: () => void; showToast: (message: string) => void }) {
  return <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-6 shadow-xl"><div className="flex justify-end"><button aria-label="상세 패널 닫기" className="cursor-pointer text-slate-500 hover:text-slate-900" onClick={onClose}><X /></button></div><div className="mt-2 flex items-center gap-3"><div className="flex h-16 min-w-16 items-center justify-center rounded-full border border-slate-200 text-lg font-bold">{member.displayName.slice(0, 3)}</div><div><h2 className="text-xl font-bold">{member.displayName}</h2><p className="text-sm text-slate-500">{[member.jobTitle, member.jobGradeName].filter(Boolean).join(" / ") || "직급 미지정"}</p></div></div><div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs text-blue-600"><button className="cursor-pointer rounded-lg p-2 hover:bg-blue-50" onClick={() => showToast("메신저 기능은 준비 중입니다.")}><MessageCircle className="mx-auto mb-1" size={20} />메시지</button><button className="cursor-pointer rounded-lg p-2 hover:bg-blue-50" onClick={() => showToast("메일 기능은 준비 중입니다.")}><Mail className="mx-auto mb-1" size={20} />메일</button><button className="cursor-pointer rounded-lg p-2 hover:bg-blue-50" onClick={() => showToast("캘린더 기능은 준비 중입니다.")}>▣<br />캘린더</button></div><dl className="mt-8 space-y-5 text-sm"><Info label="소속" value={`${member.companyName}${member.departmentName ? ` · ${member.departmentName}` : ""}`} /><Info label="전화" value={member.phoneNumber ?? "-"} /><Info label="이메일" value={member.email} /><Info label="입사일" value={member.hiredAt ?? "-"} /></dl></aside>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="mb-1 text-xs text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>; }
