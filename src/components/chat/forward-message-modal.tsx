"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MessageDialogShell } from "@/components/chat/message-change-dialog";
import { Spinner } from "@/components/common/loading";
import { MeBadge } from "@/components/common/me-badge";
import type { ChatMessage, ChatRoom } from "@/lib/api/chat-api";

const MAX_TARGETS = 10;

type ForwardMessageModalProps = {
  message: ChatMessage;
  rooms: ChatRoom[];
  roomName: (room: ChatRoom) => string;
  onClose: () => void;
  // 선택한 방 ID 목록을 받아 전달 요청. 실패하면 모달은 그대로 두고 호출 쪽에서 토스트.
  onSubmit: (targetRoomIds: number[]) => Promise<boolean>;
};

// 메시지를 보낼 방을 여러 개 고르는 모달. 검색으로 좁히고 체크해서 "전달" 버튼으로 보냄.
export function ForwardMessageModal({
  message,
  rooms,
  roomName,
  onClose,
  onSubmit,
}: ForwardMessageModalProps) {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const visibleRooms = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return rooms;
    return rooms.filter((room) => roomName(room).toLocaleLowerCase().includes(normalized));
  }, [keyword, rooms, roomName]);

  const toggle = (roomId: number) =>
    setSelected((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : current.length >= MAX_TARGETS
          ? current
          : [...current, roomId],
    );

  const submit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const done = await onSubmit(selected);
      if (done) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MessageDialogShell title="메시지 전달" onClose={onClose} widthClassName="max-w-md">
      {/* 전달할 내용을 한 줄로 보여 줘 무엇을 보내는지 확인하게 함. */}
      <p className="mb-4 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {message.content.replace(/[\r\n]+/g, " ")}
      </p>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-400">
        <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          data-dialog-initial-focus
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="메시지방 검색"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </label>
      <ul className="mt-3 h-72 overflow-y-auto rounded-lg border border-slate-200 p-1">
        {visibleRooms.length === 0 && (
          <li className="flex h-full items-center justify-center text-sm text-slate-400">
            일치하는 메시지방이 없습니다.
          </li>
        )}
        {visibleRooms.map((room) => {
          const checked = selected.includes(room.id);
          const disabled = !checked && selected.length >= MAX_TARGETS;
          return (
            <li key={room.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-disabled={disabled}
                onClick={() => !disabled && toggle(room.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${checked ? "bg-blue-50" : disabled ? "cursor-not-allowed text-slate-300" : "cursor-pointer hover:bg-slate-50"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
                {room.type === "SELF" && <MeBadge />}
                <span className="min-w-0 flex-1 truncate font-medium">{roomName(room)}</span>
                {room.type === "GROUP" && (
                  <span className="shrink-0 text-xs text-slate-400">{room.memberCount}명</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {selected.length}/{MAX_TARGETS}개 선택
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-slate-200 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50 active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={selected.length === 0 || submitting}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Spinner size={14} />}
            전달{selected.length > 0 && ` (${selected.length})`}
          </button>
        </div>
      </div>
    </MessageDialogShell>
  );
}
