"use client";

import { Copy, MoreVertical, Pencil, Reply, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type MessageMenuPosition = { left: number; top: number };

type MessageActionMenuProps = {
  isMine: boolean;
  position: MessageMenuPosition | null;
  onPositionChange: (position: MessageMenuPosition | null) => void;
  onCopy: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

// 목록의 overflow 영역 밖에 메뉴를 띄워 말풍선·스크롤 경계에 가려지는 현상 방지.
export function MessageActionMenu({ isMine, position, onPositionChange, onCopy, onReply, onEdit, onDelete }: MessageActionMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const focusFrame = requestAnimationFrame(() => menuRef.current?.querySelector("button")?.focus({ preventScroll: true }));
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        onPositionChange(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onPositionChange(null);
      buttonRef.current?.focus({ preventScroll: true });
    };
    const closeOnScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) onPositionChange(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [position, onPositionChange]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="메시지 메뉴"
        aria-expanded={Boolean(position)}
        aria-haspopup="true"
        onClick={(event) => {
          if (position) { onPositionChange(null); return; }
          const rect = buttonRef.current?.getBoundingClientRect();
          if (!rect) return;
          // 마우스 클릭은 커서 좌표, 키보드 실행만 버튼 위치를 기준으로 표시.
          const left = event.detail === 0 ? (isMine ? rect.left - 148 : rect.right + 4) : event.clientX;
          const top = event.detail === 0 ? rect.bottom + 4 : event.clientY;
          onPositionChange({
            left: Math.max(8, Math.min(left, window.innerWidth - 152)),
            top: Math.max(8, Math.min(top, window.innerHeight - (isMine ? 184 : 100))),
          });
        }}
        className={`flex h-5 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-500 active:scale-95 [@media(hover:none)]:opacity-100 ${position ? "bg-slate-100 opacity-100" : "opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100"}`}
      >
        <MoreVertical size={17} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div ref={menuRef} role="group" aria-label="메시지 작업" style={position} className="message-action-menu fixed z-[110] w-36 rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-lg">
          <button type="button" onClick={() => { onPositionChange(null); onCopy(); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 active:scale-[0.98]">
            <Copy size={15} aria-hidden="true" />복사
          </button>
          <button type="button" onClick={() => { onPositionChange(null); onReply(); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 active:scale-[0.98]">
            <Reply size={15} aria-hidden="true" />답장
          </button>
          {isMine && <>
            <div className="my-1 border-t border-slate-100" />
            <button type="button" onClick={() => { onPositionChange(null); onEdit(); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 active:scale-[0.98]">
              <Pencil size={15} aria-hidden="true" />수정
            </button>
            <button type="button" onClick={() => { onPositionChange(null); onDelete(); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-red-500 transition hover:bg-red-50 focus-visible:bg-red-50 active:scale-[0.98]">
              <Trash2 size={15} aria-hidden="true" />삭제
            </button>
          </>}
        </div>, document.body,
      )}
    </>
  );
}
