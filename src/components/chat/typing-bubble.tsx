"use client";

import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import type { AddressBookMember } from "@/lib/api/address-book-api";

// 실제 수신 말풍선과 같은 구조로 입력 중 상태만 표시.
export function TypingBubble({
  member,
  additionalCount,
  isGroup,
  senderProfile,
  leaving,
  onProfileClick,
}: {
  member: { membershipId: number; displayName: string };
  additionalCount: number;
  isGroup: boolean;
  senderProfile?: AddressBookMember;
  leaving: boolean;
  onProfileClick: (membershipId: number) => void;
}) {
  const label =
    isGroup && additionalCount > 0
      ? `${member.displayName} 외 ${additionalCount}명이 입력 중입니다`
      : `${member.displayName}님이 입력 중입니다`;
  const bubble = (
    <div className="relative inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-400 after:absolute after:-left-2 after:top-3 after:h-3 after:w-3 after:bg-slate-100 after:[clip-path:polygon(100%_0,100%_100%,0_0)]">
      <span>{label}</span>
      <span className="inline-flex items-center gap-0.5" aria-label="입력 중">
        <i className="typing-dot inline-block h-1 w-1 rounded-full bg-slate-400" />
        <i className="typing-dot typing-dot-delay-1 inline-block h-1 w-1 rounded-full bg-slate-400" />
        <i className="typing-dot typing-dot-delay-2 inline-block h-1 w-1 rounded-full bg-slate-400" />
      </span>
    </div>
  );

  if (!isGroup) {
    return (
      <div
        className={`typing-bubble ${leaving ? "typing-bubble-exit" : "typing-bubble-enter"} mb-4 mr-auto max-w-[85%]`}
      >
        {bubble}
      </div>
    );
  }

  return (
    <div
      className={`typing-bubble ${leaving ? "typing-bubble-exit" : "typing-bubble-enter"} mb-4 flex items-start gap-2`}
    >
      <MessageMemberAvatar
        name={senderProfile?.displayName ?? member.displayName}
        presenceStatus={senderProfile?.presenceStatus ?? "OFFLINE"}
        statusType={senderProfile?.statusType}
        onClick={() => onProfileClick(member.membershipId)}
      />
      <div className="w-fit max-w-[70%]">
        <button
          type="button"
          onClick={() => onProfileClick(member.membershipId)}
          className="cursor-pointer text-left text-sm font-bold transition hover:text-blue-600"
        >
          {senderProfile?.displayName ?? member.displayName}
        </button>
        <div className="mt-1 flex items-end gap-2">{bubble}</div>
      </div>
    </div>
  );
}
