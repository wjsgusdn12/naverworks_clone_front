"use client";

import { SmilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReactionEmoji } from "@/components/chat/reaction-emoji";
import { Tooltip } from "@/components/common/tooltip";
import { REACTION_EMOJIS } from "@/lib/chat-reactions";

type ReactionPickerProps = {
  // 내 말풍선이면 선택창을 버튼 왼쪽으로, 상대 말풍선이면 오른쪽으로 펼침.
  isMine: boolean;
  // 내가 이미 누른 이모지 코드. 버튼 색과 선택창 강조에 사용.
  reactedEmojis: string[];
  // 보낸 지 24시간이 지난 메시지. 선택창을 열지 않고 안내 문구를 툴팁으로 띄움.
  expiredMessage?: string | null;
  onReact: (emoji: string) => void;
};

const PICKER_WIDTH = 236;
const PICKER_HEIGHT = 48;

// 시간과 ⋮ 사이의 스마일 버튼. 누르면 이모지 선택창이 뜨고, 이미 누른 게 있으면 버튼이 색칠된 채 항상 보임.
export function ReactionPicker({
  isMine,
  reactedEmojis,
  expiredMessage = null,
  onReact,
}: ReactionPickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const reacted = reactedEmojis.length > 0;

  useEffect(() => {
    if (!position) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        !pickerRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setPosition(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPosition(null);
      buttonRef.current?.focus({ preventScroll: true });
    };
    const closeOnScroll = (event: Event) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPosition(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [position]);

  const open = () => {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 버튼 위쪽에 띄우되, 화면 위가 모자라면 아래로. 좌우는 화면 안으로 밀어 넣음.
    const left = isMine ? rect.right - PICKER_WIDTH : rect.left;
    const top = rect.top - PICKER_HEIGHT - 6 >= 8 ? rect.top - PICKER_HEIGHT - 6 : rect.bottom + 6;
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - PICKER_WIDTH - 8)),
      top,
    });
  };

  // 기간이 지나면 disabled 대신 aria-disabled로 두어 hover 툴팁이 계속 뜨게 함.
  if (expiredMessage) {
    return (
      <Tooltip label={expiredMessage} multiline>
        <button
          type="button"
          aria-label="리액션 남기기"
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
          className={`flex h-5 w-6 shrink-0 cursor-not-allowed items-center justify-center rounded-md transition duration-150 [@media(hover:none)]:opacity-100 ${
            reacted
              ? "text-amber-400 opacity-100"
              : "text-slate-300 opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100"
          }`}
        >
          <SmilePlus size={16} aria-hidden="true" fill={reacted ? "#fef3c7" : "none"} />
        </button>
      </Tooltip>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={reacted ? "리액션 변경" : "리액션 남기기"}
        aria-expanded={Boolean(position)}
        aria-haspopup="true"
        onClick={open}
        className={`flex h-5 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition duration-150 hover:bg-slate-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-500 active:scale-95 [@media(hover:none)]:opacity-100 ${
          reacted
            ? "text-amber-500 opacity-100 hover:text-amber-600"
            : position
              ? "bg-slate-100 text-slate-900 opacity-100"
              : "text-slate-500 opacity-0 hover:text-slate-900 group-hover/message:opacity-100 group-focus-within/message:opacity-100"
        }`}
      >
        <SmilePlus size={16} aria-hidden="true" fill={reacted ? "#fef3c7" : "none"} />
      </button>
      {position &&
        createPortal(
          <div
            ref={pickerRef}
            role="group"
            aria-label="리액션 선택"
            style={{ ...position, width: PICKER_WIDTH }}
            className="message-action-menu fixed z-[110] flex items-center justify-between rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-lg"
          >
            {REACTION_EMOJIS.map((item) => {
              const isReacted = reactedEmojis.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  aria-label={`${item.label} ${isReacted ? "취소" : "리액션"}`}
                  aria-pressed={isReacted}
                  onClick={() => {
                    setPosition(null);
                    onReact(item.code);
                  }}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:scale-125 ${isReacted ? "bg-blue-100 ring-1 ring-blue-400" : "hover:bg-slate-100"}`}
                >
                  <ReactionEmoji code={item.code} size={22} />
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
