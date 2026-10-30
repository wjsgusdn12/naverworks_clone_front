"use client";

import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { Tabs } from "@/components/common/tabs";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ReadModalState } from "@/lib/chat-page-helpers";
import { useMemberBadge } from "@/hooks/use-member-badge";
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
  // 행마다 주소록 배열을 다시 훑지 않도록 구성원 프로필을 Map으로 한 번만 만들어 둠.
  const profileByMemberId = useMemo(
    () => new Map(contactMembers.map((member) => [member.membershipId, member])),
    [contactMembers],
  );
  // 본인·실시간 상태까지 반영한 배지 값.
  const badgeOf = useMemberBadge(profileByMemberId);
  const members = modal.read ? modal.readMembers : modal.unreadMembers;
  const tabs = [
    { key: "read" as const, label: "읽음", count: modal.readMembers.length },
    { key: "unread" as const, label: "안 읽음", count: modal.unreadMembers.length },
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
        <Tabs
          className="mt-5"
          items={tabs}
          value={modal.read ? "read" : "unread"}
          onChange={(key) => onTab(key === "read")}
          ariaLabel="읽음 여부"
        />
        <div role="tabpanel" className="mt-2 min-h-0 flex-1 overflow-y-auto p-1">
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
                  presenceStatus={badgeOf(member.membershipId).presenceStatus}
                  statusType={badgeOf(member.membershipId).statusType}
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
