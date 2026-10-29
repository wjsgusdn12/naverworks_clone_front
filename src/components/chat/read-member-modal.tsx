"use client";

import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ReadModalState } from "@/lib/chat-page-helpers";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

export function ReadMemberModal({
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
