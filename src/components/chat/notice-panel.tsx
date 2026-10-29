"use client";

import { ChevronDown, ChevronUp, Megaphone, MoreVertical } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "@/components/common/tooltip";
import type { ChatNotice } from "@/lib/api/chat-api";

type NoticePanelProps = {
  roomId: number;
  // 최근 등록이 앞.
  notices: ChatNotice[];
  // 본문을 누르면 원문 말풍선으로 이동(답장 원문 이동과 같은 강조).
  onOpen: (messageId: number) => void;
  // 공지 내리기: 서버에서 지워져 모든 참여자에게서 사라짐.
  onRemove: (messageId: number) => void;
};

// 한 줄에 보여 줄 수 있는 공지 수. 넘어가면 펼친 목록의 높이를 고정하고 스크롤.
const VISIBLE_ROWS = 4;
const ROW_HEIGHT = 58;

const hiddenKey = (roomId: number) => `naverworks:notice:hidden:${roomId}`;
const iconKey = (roomId: number) => `naverworks:notice:icon:${roomId}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간을 못 써도 화면 동작에는 지장 없음.
  }
};

const firstLine = (content: string) => content.replace(/[\r\n]+/g, " ").trim();

// 메시지 영역 위에 떠 있는 공지 카드. 세 가지 모양을 오감.
//  - 한 줄: 최신 공지 하나만 보여 주고 ∨ 로 펼침
//  - 목록: 공지 전체(각 줄 ⋮ 메뉴), 아래에 "다시 보지 않기 · 접기"와 ∧
//  - 아이콘: "접기"를 누르면 오른쪽 위 확성이 아이콘만 남김(날짜 칩과 같은 줄)
// 부모가 방마다 key로 새로 마운트하므로 저장된 상태는 처음 한 번만 읽음.
export function NoticePanel({ roomId, notices, onOpen, onRemove }: NoticePanelProps) {
  const [expanded, setExpanded] = useState(false);
  // "다시 보지 않기"로 내 화면에서만 숨긴 공지 ID. 브라우저에 기억.
  const [hiddenIds, setHiddenIds] = useState<number[]>(() => readJson(hiddenKey(roomId), []));
  // "접기"로 아이콘만 남긴 시점의 최신 공지 ID. 새 공지가 오면 값이 달라져 자동으로 다시 펼쳐짐.
  const [iconFor, setIconFor] = useState<number | null>(() => readJson(iconKey(roomId), null));
  const [menu, setMenu] = useState<{ messageId: number; left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => notices.filter((notice) => !hiddenIds.includes(notice.messageId)),
    [notices, hiddenIds],
  );
  const latest = visible[0];
  const isIcon = latest !== undefined && iconFor === latest.messageId;

  // 메뉴 바깥 클릭·Esc·스크롤에 닫기.
  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", closeOutside as unknown as EventListener, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", closeOutside as unknown as EventListener, true);
    };
  }, [menu]);

  if (!latest) return null;

  const hide = (ids: number[]) => {
    const next = Array.from(new Set([...hiddenIds, ...ids]));
    setHiddenIds(next);
    writeJson(hiddenKey(roomId), next);
    setMenu(null);
  };
  const collapseToIcon = () => {
    setIconFor(latest.messageId);
    writeJson(iconKey(roomId), latest.messageId);
    setExpanded(false);
  };
  const restore = () => {
    setIconFor(null);
    writeJson(iconKey(roomId), null);
  };

  const iconButton = (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <Megaphone size={14} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );

  if (isIcon) {
    return (
      <div className="pointer-events-none absolute right-6 top-4 z-30">
        <Tooltip label="공지 보기">
          <button
            type="button"
            aria-label="공지 보기"
            onClick={restore}
            className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:bg-blue-50 active:scale-90"
          >
            <Megaphone size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    );
  }

  const row = (notice: ChatNotice, withMenu: boolean) => (
    <div
      key={notice.messageId}
      className="flex items-center gap-3 px-4"
      style={{ height: ROW_HEIGHT }}
    >
      {iconButton}
      <button
        type="button"
        onClick={() => onOpen(notice.messageId)}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label="공지 원문으로 이동"
      >
        <span className="block truncate text-sm font-medium leading-5 text-slate-800">
          {firstLine(notice.content)}
        </span>
        <span className="block truncate text-xs leading-4 text-slate-500">{notice.senderName}</span>
      </button>
      {withMenu && (
        <button
          type="button"
          aria-label="공지 메뉴"
          aria-haspopup="true"
          aria-expanded={menu?.messageId === notice.messageId}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu((current) =>
              current?.messageId === notice.messageId
                ? null
                : { messageId: notice.messageId, left: rect.right, top: rect.bottom + 4 },
            );
          }}
          className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-90 ${menu?.messageId === notice.messageId ? "bg-slate-100" : ""}`}
        >
          <MoreVertical size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  return (
    <div
      role="region"
      aria-label="공지"
      className="absolute left-1/2 top-3 z-30 w-[calc(100%-3rem)] max-w-3xl -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-md"
    >
      {expanded ? (
        <>
          <div
            className="divide-y divide-slate-100 overflow-y-auto"
            style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS }}
          >
            {visible.map((notice) => row(notice, true))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
            <div className="flex gap-4 text-sm text-blue-600">
              <button
                type="button"
                onClick={() => hide(visible.map((notice) => notice.messageId))}
                className="cursor-pointer hover:underline"
              >
                다시 보지 않기
              </button>
              <button
                type="button"
                onClick={collapseToIcon}
                className="cursor-pointer hover:underline"
              >
                접기
              </button>
            </div>
            <Tooltip label="한 줄로 보기">
              <button
                type="button"
                aria-label="공지 목록 닫기"
                onClick={() => setExpanded(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 active:scale-90"
              >
                <ChevronUp size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </>
      ) : (
        <div className="flex items-center pr-2">
          <div className="min-w-0 flex-1">{row(latest, false)}</div>
          <Tooltip label={visible.length > 1 ? `공지 ${visible.length}개 보기` : "펼치기"}>
            <button
              type="button"
              aria-label="공지 목록 펼치기"
              aria-expanded={false}
              onClick={() => setExpanded(true)}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 active:scale-90"
            >
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="group"
            aria-label="공지 작업"
            style={{ left: menu.left, top: menu.top }}
            className="message-action-menu fixed z-[110] w-36 -translate-x-full rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-lg"
          >
            <button
              type="button"
              onClick={() => hide([menu.messageId])}
              className="flex w-full cursor-pointer items-center rounded px-3 py-2 text-left transition hover:bg-slate-100 active:scale-[0.98]"
            >
              다시 보지 않기
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                onRemove(menu.messageId);
              }}
              className="flex w-full cursor-pointer items-center rounded px-3 py-2 text-left transition hover:bg-slate-100 active:scale-[0.98]"
            >
              공지 내리기
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
