"use client";

import type { ChatRoom } from "@/lib/api/chat-api";
import type { RoomSort } from "@/lib/chat-room-sort";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import type { ReactNode, RefObject } from "react";

// 왼쪽 메시지방 목록 사이드바. 상태는 page가 가지고 값·콜백만 내려받음.
export function MessageRoomSidebar({
  isSidebarCollapsed,
  onCreateRoom,
  sortMenuRef,
  sortMenuOpen,
  onToggleSortMenu,
  roomSort,
  onSelectSort,
  filteredRooms,
  groupRooms,
  generalRooms,
  groupCategoryOpen,
  onToggleGroupCategory,
  generalCategoryOpen,
  onToggleGeneralCategory,
  renderRoomItem,
  hideSelectionMode,
  hiddenRoomCount,
  onConfirmHide,
  onCancelHide,
}: {
  isSidebarCollapsed: boolean;
  onCreateRoom: () => void;
  sortMenuRef: RefObject<HTMLDivElement | null>;
  sortMenuOpen: boolean;
  onToggleSortMenu: () => void;
  roomSort: RoomSort;
  onSelectSort: (sort: RoomSort) => void;
  filteredRooms: ChatRoom[];
  groupRooms: ChatRoom[];
  generalRooms: ChatRoom[];
  groupCategoryOpen: boolean;
  onToggleGroupCategory: () => void;
  generalCategoryOpen: boolean;
  onToggleGeneralCategory: () => void;
  renderRoomItem: (room: ChatRoom) => ReactNode;
  hideSelectionMode: boolean;
  hiddenRoomCount: number;
  onConfirmHide: () => void;
  onCancelHide: () => void;
}) {
  return (
    <aside
      className={`relative z-50 flex shrink-0 flex-col overflow-visible border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ${isSidebarCollapsed ? "w-20" : "w-[360px]"}`}
    >
      <button
        onClick={onCreateRoom}
        className={`m-3 h-11 cursor-pointer rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[.98] ${isSidebarCollapsed ? "text-xl" : ""}`}
      >
        {isSidebarCollapsed ? "+" : "새로 만들기"}
      </button>
      {!isSidebarCollapsed && (
        <div className="flex items-center justify-between px-5 pb-2">
          <p className="text-sm font-bold">메시지방</p>
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              aria-label="메시지방 정렬"
              aria-expanded={sortMenuOpen}
              onClick={onToggleSortMenu}
              className="flex cursor-pointer items-center gap-0.5 rounded p-1 text-slate-700 transition hover:bg-slate-200"
            >
              <ArrowDownUp size={18} />
              <ChevronDown
                className={`transition-transform ${sortMenuOpen ? "rotate-180" : ""}`}
                size={14}
              />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 z-40 mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                {(
                  [
                    { value: "TYPE", label: "종류순" },
                    { value: "LATEST", label: "시간순" },
                    { value: "UNREAD", label: "안 읽은 메시지 순" },
                  ] as { value: RoomSort; label: string }[]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSelectSort(option.value)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-blue-50 ${roomSort === option.value ? "font-bold text-blue-600" : "text-slate-700"}`}
                  >
                    <span className="flex w-4 justify-center">
                      {roomSort === option.value && <Check size={16} strokeWidth={3} />}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {roomSort === "TYPE" && !isSidebarCollapsed ? (
          <>
            {groupRooms.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={onToggleGroupCategory}
                  className="flex w-full cursor-pointer items-center gap-1 px-5 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <ChevronDown
                    className={`transition-transform ${groupCategoryOpen ? "" : "-rotate-90"}`}
                    size={14}
                  />
                  조직/그룹
                </button>
                {groupCategoryOpen && groupRooms.map(renderRoomItem)}
              </section>
            )}
            {generalRooms.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={onToggleGeneralCategory}
                  className="flex w-full cursor-pointer items-center gap-1 px-5 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <ChevronDown
                    className={`transition-transform ${generalCategoryOpen ? "" : "-rotate-90"}`}
                    size={14}
                  />
                  일반
                </button>
                {generalCategoryOpen && generalRooms.map(renderRoomItem)}
              </section>
            )}
          </>
        ) : (
          filteredRooms.map(renderRoomItem)
        )}
        {!isSidebarCollapsed && filteredRooms.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">표시할 메시지방이 없습니다.</p>
        )}
      </div>
      {hideSelectionMode && !isSidebarCollapsed && (
        <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            disabled={hiddenRoomCount === 0}
            onClick={onConfirmHide}
            className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            숨김 ({hiddenRoomCount})
          </button>
          <button
            type="button"
            onClick={onCancelHide}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50"
          >
            취소
          </button>
        </div>
      )}
    </aside>
  );
}
