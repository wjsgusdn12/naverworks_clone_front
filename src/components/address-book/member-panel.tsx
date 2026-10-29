"use client";

import { FavoriteButton } from "@/components/address-book/favorite-button";
import { MemberAvatar } from "@/components/address-book/member-avatar";
import type { AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { CalendarDays, ExternalLink, Mail, MessageCircle, X } from "lucide-react";

export function MemberPanel({
  member,
  onClose,
  onToggleFavorite,
  onMessage,
  showToast,
}: {
  member: AddressBookMemberDetail;
  onClose: () => void;
  onToggleFavorite: () => void;
  onMessage: () => void;
  showToast: (message: string) => void;
}) {
  return (
    <aside className="relative w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <div className="flex justify-end gap-2">
        <button
          aria-label="프로필 상세 열기"
          className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          onClick={() => showToast("프로필 상세 기능은 준비 중입니다.")}
        >
          <ExternalLink size={20} />
        </button>
        <button
          aria-label="상세 패널 닫기"
          className="cursor-pointer rounded-md p-0 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <MemberAvatar member={member} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{member.displayName}</h2>
          <p className="text-sm text-slate-500">
            {[member.jobTitle, member.jobGradeName].filter(Boolean).join(" / ") || "직급 미지정"}
          </p>
        </div>
      </div>
      <span className="absolute right-4 top-[4.25rem]">
        <FavoriteButton active={member.favorite} onClick={onToggleFavorite} size="panel" />
      </span>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-blue-600">
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={onMessage}
        >
          <MessageCircle className="mx-auto mb-1" size={20} />
          메시지
        </button>
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={() => showToast("메일 기능은 준비 중입니다.")}
        >
          <Mail className="mx-auto mb-1" size={20} />
          메일
        </button>
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={() => showToast("캘린더 기능은 준비 중입니다.")}
        >
          <CalendarDays className="mx-auto mb-1" size={20} />
          캘린더
        </button>
      </div>
      <dl className="mt-6 space-y-4 text-sm">
        <Info label="소속" value={member.companyName} strong />
        <Info label="" value={member.departmentName ?? "부서 미지정"} />
        <Info label="전화" value={member.phoneNumber ?? "-"} />
        <Info label="이메일" value={member.email ?? "-"} />
        <Info label="입사일" value={member.hiredAt ?? "-"} />
      </dl>
    </aside>
  );
}

function Info({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="mb-1 text-xs text-slate-500">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
