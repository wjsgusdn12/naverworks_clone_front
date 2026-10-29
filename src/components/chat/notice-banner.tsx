"use client";

import { ChevronDown, Megaphone, X } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/common/tooltip";
import type { ChatNotice } from "@/lib/api/chat-api";

type NoticeBannerProps = {
  roomId: number;
  notice: ChatNotice;
  // 본문을 누르면 원문 말풍선으로 이동.
  onOpen: (messageId: number) => void;
  onRemove: () => void;
};

const storageKey = (roomId: number, messageId: number) =>
  `naverworks:notice:collapsed:${roomId}:${messageId}`;

// 방 상단에 고정되는 공지 띠. 접은 상태는 사용자별로 브라우저에 기억(같은 공지에 한해).
// 부모가 key로 방·공지마다 새로 마운트하므로 초기값을 한 번만 읽으면 됨.
export function NoticeBanner({ roomId, notice, onOpen, onRemove }: NoticeBannerProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem(storageKey(roomId, notice.messageId)) === "1"
      );
    } catch {
      return false;
    }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(storageKey(roomId, notice.messageId), "1");
      else localStorage.removeItem(storageKey(roomId, notice.messageId));
    } catch {
      // 저장 공간을 못 써도 화면 동작에는 지장 없음.
    }
  };

  return (
    <div
      role="region"
      aria-label="공지"
      className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/70 px-6 py-2.5"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
        <Megaphone size={13} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={() => onOpen(notice.messageId)}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label="공지 원문으로 이동"
      >
        <span
          className={`block text-sm leading-6 text-slate-800 ${collapsed ? "truncate" : "max-h-36 overflow-y-auto whitespace-pre-wrap break-words"}`}
        >
          {collapsed ? notice.content.replace(/[\r\n]+/g, " ") : notice.content}
        </span>
        {!collapsed && (
          <span className="mt-1 block text-xs text-slate-500">
            {notice.senderName}
            {notice.setByName && ` · ${notice.setByName}님이 등록`}
          </span>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip label={collapsed ? "펼치기" : "접기"}>
          <button
            type="button"
            aria-label={collapsed ? "공지 펼치기" : "공지 접기"}
            aria-expanded={!collapsed}
            onClick={toggle}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-amber-100 hover:text-slate-800 active:scale-90"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
              aria-hidden="true"
            />
          </button>
        </Tooltip>
        <Tooltip label="공지 해제">
          <button
            type="button"
            aria-label="공지 해제"
            onClick={onRemove}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-amber-100 hover:text-slate-800 active:scale-90"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
