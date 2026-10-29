"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ChatRoom } from "@/lib/api/chat-api";
import { formatRoomTime } from "@/lib/chat-format";
import { AtSign, Bell, Check, EyeOff, Forward, LogOut, MoreVertical, Pin } from "lucide-react";
import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 방 항목은 memo로 묶어, 메시지 입력·수신 등으로 부모가 다시 그려져도 자기 props가 같으면 건너뜀.
// 그래서 콜백은 방마다 새 함수를 만들지 않고, 어느 방인지를 인자로 받는 고정 함수를 사용.
export const MessageRoomItem = memo(function MessageRoomItem({
  room,
  currentMember,
  contactMemberById,
  isSelected,
  typingPreviewLabel,
  isCollapsed,
  onSelect,
  onProfileClick,
  menuOpen,
  hideSelectionMode,
  hiddenSelected,
  onToggleMenu,
  onToggleHidden,
  onAction,
}: {
  room: ChatRoom;
  currentMember: { membershipId: number; displayName: string } | null;
  contactMemberById: Map<number, AddressBookMember>;
  isSelected: boolean;
  typingPreviewLabel: string | null;
  isCollapsed: boolean;
  onSelect: (roomId: number) => void;
  onProfileClick: (membershipId: number) => void;
  menuOpen: boolean;
  hideSelectionMode: boolean;
  hiddenSelected: boolean;
  onToggleMenu: (roomId: number) => void;
  onToggleHidden: (roomId: number) => void;
  onAction: (room: ChatRoom, action: "notification" | "pin" | "hide" | "leave") => void;
}) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  // 1:1 방은 상대방, 나와의 채팅은 본인 프로필을 목록에 표시.
  const isSelf = room.type === "SELF";
  const isDirect = room.type === "DIRECT";
  const displayName = isSelf
    ? (currentMember?.displayName ?? "나")
    : isDirect
      ? (room.directDisplayName ?? "사용자")
      : (room.name ?? "그룹 메시지");
  const avatarName = isSelf
    ? (currentMember?.displayName ?? "나")
    : isDirect
      ? (room.directDisplayName ?? "사용자")
      : (room.name ?? "그룹");
  const isTypingPreview = Boolean(typingPreviewLabel);
  const lastMessage = room.lastMessage ?? "대화를 시작해 보세요.";
  // 실제 Enter 줄바꿈만 두 줄 미리보기로 취급. 단순히 긴 한 줄은 다음 줄로 넘기지 않음.
  const previewLines = lastMessage.split(/\r?\n/);
  const hasLineBreak = previewLines.length > 1;
  const secondPreview = previewLines.length > 2 ? `${previewLines[1]} …` : previewLines[1];
  const sentByMe = !isTypingPreview && room.lastSenderMembershipId === currentMember?.membershipId;
  const presenceStatus = isSelf
    ? "ONLINE"
    : (contactMemberById.get(room.directMembershipId ?? -1)?.presenceStatus ?? "OFFLINE");

  return (
    <div
      data-room-menu
      className={`group relative flex w-[calc(100%-1rem)] gap-3 rounded-lg ${isCollapsed ? "mx-2 my-1 justify-center px-2 py-3" : "mx-2 my-1 px-3 py-3"} text-left transition-colors duration-200 hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}
    >
      {hideSelectionMode && !isCollapsed && (
        <button
          type="button"
          role="checkbox"
          aria-checked={hiddenSelected}
          onClick={() => onToggleHidden(room.id)}
          className={`custom-checkbox-button mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${hiddenSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}
        >
          {hiddenSelected && <Check size={14} strokeWidth={3} />}
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={displayName}
        onClick={() => onSelect(room.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(room.id);
          }
        }}
        className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left"
      >
        <span className="relative shrink-0">
          {room.type === "GROUP" ? (
            <GroupAvatar name={avatarName} />
          ) : (
            <MessageMemberAvatar
              name={avatarName}
              presenceStatus={presenceStatus}
              onClick={() =>
                onProfileClick(isSelf ? currentMember!.membershipId : room.directMembershipId!)
              }
            />
          )}
          {room.pinned && (
            <span className="absolute -left-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-blue-100">
              <Pin size={9} fill="currentColor" strokeWidth={2.5} />
            </span>
          )}
        </span>
        {!isCollapsed && (
          <span className="min-w-0 flex-1">
            <span className="flex justify-between gap-2">
              <b className="flex min-w-0 items-center gap-1 truncate">
                {isSelf && (
                  <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[9px] text-white">
                    나
                  </span>
                )}
                <span className="truncate">{displayName}</span>
                {room.type === "GROUP" && (
                  <span className="shrink-0 text-base font-extrabold text-blue-600">
                    {room.memberCount}
                  </span>
                )}
              </b>
              {/* 시간과 메뉴를 동일한 고정 영역에 겹쳐 행 너비가 흔들리지 않게 함. */}
              <span className="static h-5 w-16 shrink-0">
                <small
                  className={`absolute right-3 top-3 whitespace-nowrap text-right leading-5 text-slate-500 transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}
                >
                  {formatRoomTime(room.lastMessageAt)}
                </small>
                <button
                  ref={menuButtonRef}
                  type="button"
                  aria-label="메시지방 메뉴"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenuPosition({ left: rect.left, top: rect.bottom + 6 });
                    onToggleMenu(room.id);
                  }}
                  className={`absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-slate-600 opacity-0 transition-opacity duration-150 hover:bg-slate-200 group-hover:pointer-events-auto group-hover:opacity-100 ${menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none"}`}
                >
                  <MoreVertical size={17} />
                </button>
              </span>
            </span>
            <span className="mt-0.5 flex items-start gap-2">
              <span className="flex min-w-0 flex-1 items-start gap-1 text-slate-600">
                {sentByMe && (
                  <Forward className="mt-0.5 shrink-0 text-slate-600" size={15} strokeWidth={3} />
                )}
                <span className="min-w-0 flex-1 text-[16px]">
                  {isTypingPreview ? (
                    <small className="flex items-center gap-1 truncate text-slate-500">
                      <span className="truncate">{typingPreviewLabel}</span>
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5"
                        aria-label="입력 중"
                      >
                        <i className="typing-dot inline-block h-1 w-1 rounded-full bg-slate-400" />
                        <i className="typing-dot typing-dot-delay-1 inline-block h-1 w-1 rounded-full bg-slate-400" />
                        <i className="typing-dot typing-dot-delay-2 inline-block h-1 w-1 rounded-full bg-slate-400" />
                      </span>
                    </small>
                  ) : (
                    <>
                      <small className="block truncate">{previewLines[0] || " "}</small>
                      {hasLineBreak && (
                        <small className="block truncate">{secondPreview || " "}</small>
                      )}
                    </>
                  )}
                </span>
              </span>
              {room.unreadCount > 0 && (
                <em
                  className={`mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-full bg-red-500 px-1.5 text-[12px] font-bold leading-none not-italic text-white transition-opacity duration-150 group-hover:opacity-0 ${menuOpen ? "opacity-0" : ""}`}
                >
                  {room.lastMessageMentioned && (
                    <AtSign size={11} strokeWidth={3} aria-label="나를 멘션한 메시지" />
                  )}
                  {room.unreadCount > 999 ? "999+" : room.unreadCount}
                </em>
              )}
            </span>
          </span>
        )}
      </div>
      {menuOpen &&
        !isCollapsed &&
        menuPosition &&
        createPortal(
          <div
            data-room-menu
            className="fixed z-[200] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95"
            style={menuPosition}
          >
            <button
              type="button"
              onClick={() => onAction(room, "notification")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <Bell size={15} />
              알림 설정
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "pin")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <Pin size={15} />
              {room.pinned ? "핀 고정 해제" : "핀 고정"}
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "hide")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <EyeOff size={15} />
              숨김
            </button>
            <button
              type="button"
              onClick={() => onAction(room, "leave")}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} />
              나가기
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
});
