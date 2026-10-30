"use client";

import { Bell, Eye, EyeOff, LogOut, Pin } from "lucide-react";
import { createPortal } from "react-dom";

export type RoomMenuAction = "notification" | "pin" | "hide" | "unhide" | "leave";

// 메시지방 ⋮ 메뉴(왼쪽 메시지방 목록·상단 검색 결과 공통). 화면 맨 위(body)에 띄워 목록 스크롤에 잘리지 않음.
// 숨긴 방은 알림·핀 상태를 모르므로 숨김 해제·나가기만 보여 줌.
// data-room-menu가 붙은 곳 밖을 누르면 부모가 메뉴를 닫음.
export function RoomActionMenu({
  position,
  pinned,
  hidden = false,
  onAction,
}: {
  position: { left: number; top: number };
  pinned: boolean;
  hidden?: boolean;
  onAction: (action: RoomMenuAction) => void;
}) {
  const item = "flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm";
  return createPortal(
    <div
      data-room-menu
      role="menu"
      className="fixed z-[200] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95"
      style={position}
    >
      {hidden ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => onAction("unhide")}
          className={`${item} hover:bg-slate-50`}
        >
          <Eye size={15} />
          숨김 해제
        </button>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => onAction("notification")}
            className={`${item} hover:bg-slate-50`}
          >
            <Bell size={15} />
            알림 설정
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => onAction("pin")}
            className={`${item} hover:bg-slate-50`}
          >
            <Pin size={15} />
            {pinned ? "핀 고정 해제" : "핀 고정"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => onAction("hide")}
            className={`${item} hover:bg-slate-50`}
          >
            <EyeOff size={15} />
            숨김
          </button>
        </>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction("leave")}
        className={`${item} text-red-600 hover:bg-red-50`}
      >
        <LogOut size={15} />
        나가기
      </button>
    </div>,
    document.body,
  );
}
