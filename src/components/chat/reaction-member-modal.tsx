"use client";

import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { ReactionEmoji } from "@/components/chat/reaction-emoji";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ReactionModalState } from "@/lib/chat-page-helpers";
import { reactionLabel } from "@/lib/chat-reactions";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// 메시지에 리액션한 사람 목록(네이버웍스식). 위에 이모지별 집계 칩, 아래 테두리 박스 안에 사람 목록.
// 접속 상태는 주소록 초기값에 실시간 프레즌스를 합친 contactMemberById를 읽어 읽은 멤버 모달과 같은 기준을 씀.
export function ReactionMemberModal({
  modal,
  contactMemberById,
  onClose,
  onProfileClick,
}: {
  modal: ReactionModalState;
  contactMemberById: Map<number, AddressBookMember>;
  onClose: () => void;
  onProfileClick: (membershipId: number) => void;
}) {
  // 칩을 누르면 그 이모지를 고른 사람만 보여 주고, 다시 누르면 전체로 돌아감.
  const [filterEmoji, setFilterEmoji] = useState<string | null>(null);
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    modal.members.forEach(({ emoji }) => counts.set(emoji, (counts.get(emoji) ?? 0) + 1));
    return [...counts.entries()].map(([emoji, count]) => ({ emoji, count }));
  }, [modal.members]);
  const visibleMembers = filterEmoji
    ? modal.members.filter(({ emoji }) => emoji === filterEmoji)
    : modal.members;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="리액션 멤버"
        className="message-action-menu flex h-[min(680px,calc(100vh-2rem))] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">리액션 ({modal.members.length})</h2>
          <button
            type="button"
            aria-label="리액션 닫기"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-1">
          {summary.map(({ emoji, count }) => {
            const selected = filterEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={selected}
                aria-label={`${reactionLabel(emoji)} ${count}명${selected ? ", 선택됨" : ""}`}
                onClick={() => setFilterEmoji(selected ? null : emoji)}
                className={`flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-sm transition hover:bg-slate-100 active:scale-95 ${selected ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600"}`}
              >
                <ReactionEmoji code={emoji} size={20} />
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {visibleMembers.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              아직 아무도 누르지 않았습니다.
            </p>
          ) : (
            visibleMembers.map(({ emoji, member }) => (
              <button
                type="button"
                key={member.membershipId}
                onClick={() => onProfileClick(member.membershipId)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100"
              >
                <MessageMemberAvatar
                  name={member.displayName}
                  presenceStatus={
                    contactMemberById.get(member.membershipId)?.presenceStatus ?? "OFFLINE"
                  }
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-slate-900">{member.displayName}</b>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {member.jobGradeName && (
                      <span className="text-blue-600">{member.jobGradeName}</span>
                    )}
                    {member.jobGradeName && member.departmentName && "/"}
                    {member.departmentName}
                  </span>
                </span>
                <ReactionEmoji code={emoji} size={24} />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
