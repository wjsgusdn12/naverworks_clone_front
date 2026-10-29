"use client";

import type { AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { CalendarDays, Mail, MessageCircle, Star, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function UserProfileModal({
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
