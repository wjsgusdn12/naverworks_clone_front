"use client";

import { EmojiPicker as Picker } from "frimousse";
import { SmilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoadingState } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";

// 입력칸 아래 이모지 버튼 + 이모지 판(분류별 목록·한국어 검색·최근 사용·피부색).
// 이모지 데이터는 Emojibase(MIT) 한국어 파일을 우리 서버(public/emojibase)에서 받고, 그림은 OS 기본 이모지 글꼴로 그림.

const PICKER_WIDTH = 344;
const PICKER_HEIGHT = 380;
const RECENT_KEY = "chat-recent-emojis";
const RECENT_LIMIT = 18;

// 최근 사용 이모지(이 브라우저에만 저장). 저장소를 못 쓰는 환경이면 빈 목록.
const readRecent = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

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
    const close = () => setPosition(null);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  const toggle = () => {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setRecent(readRecent());
    // 버튼 위쪽에 띄우고 좌우는 화면 안으로 밀어 넣음.
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PICKER_WIDTH - 8)),
      top: Math.max(8, rect.top - PICKER_HEIGHT - 8),
    });
  };

  // 고른 이모지를 입력칸에 넣고 최근 사용 맨 앞으로. 판은 열어 둬서 여러 개를 이어 고를 수 있음.
  const select = (emoji: string) => {
    onSelect(emoji);
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, RECENT_LIMIT);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // 저장 못 해도 이번 화면에서는 그대로 보임
    }
  };

  return (
    <>
      <Tooltip label="이모지" placement="top">
        <button
          ref={buttonRef}
          type="button"
          aria-label="이모지"
          aria-expanded={Boolean(position)}
          aria-haspopup="dialog"
          onClick={toggle}
          className={`cursor-pointer transition hover:text-blue-600 ${position ? "text-blue-600" : ""}`}
        >
          <SmilePlus size={19} />
        </button>
      </Tooltip>
      {position &&
        createPortal(
          <div
            ref={pickerRef}
            role="dialog"
            aria-label="이모지 선택"
            style={{ ...position, width: PICKER_WIDTH, height: PICKER_HEIGHT }}
            className="fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <Picker.Root
              locale="ko"
              emojibaseUrl="/emojibase"
              columns={9}
              onEmojiSelect={({ emoji }) => select(emoji)}
              className="flex h-full flex-col"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 p-2">
                <Picker.Search
                  autoFocus
                  placeholder="이모지 검색 (예: 웃음, 하트)"
                  className="h-8 min-w-0 flex-1 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                />
                <Tooltip label="피부색 바꾸기" placement="top">
                  <Picker.SkinToneSelector
                    aria-label="피부색 바꾸기"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-lg hover:bg-slate-100"
                  />
                </Tooltip>
              </div>
              {recent.length > 0 && (
                <div className="border-b border-slate-100 px-2 pb-1.5 pt-2">
                  <p className="px-1 pb-1 text-xs font-medium text-slate-500">최근 사용</p>
                  <div className="flex flex-wrap">
                    {recent.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`${emoji} 넣기`}
                        onClick={() => select(emoji)}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xl hover:bg-slate-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Picker.Viewport className="relative min-h-0 flex-1 outline-none">
                <Picker.Loading>
                  <LoadingState message="이모지를 불러오는 중입니다..." className="h-full" />
                </Picker.Loading>
                <Picker.Empty className="flex h-full items-center justify-center text-sm text-slate-500">
                  {({ search }) => `"${search}"에 맞는 이모지가 없습니다.`}
                </Picker.Empty>
                <Picker.List
                  className="select-none px-2 pb-2"
                  components={{
                    CategoryHeader: ({ category, ...props }) => (
                      <div
                        {...props}
                        className="bg-white px-1 pb-1 pt-2 text-xs font-medium text-slate-500"
                      >
                        {category.label}
                      </div>
                    ),
                    Row: ({ children, ...props }) => (
                      <div {...props} className="flex">
                        {children}
                      </div>
                    ),
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        {...props}
                        aria-label={emoji.label}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xl ${emoji.isActive ? "bg-slate-100" : ""}`}
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </Picker.Viewport>
              {/* 마우스를 올린 이모지 이름 */}
              <div className="flex h-9 items-center gap-2 border-t border-slate-100 px-3 text-xs text-slate-500">
                <Picker.ActiveEmoji>
                  {({ emoji }) =>
                    emoji ? (
                      <>
                        <span className="text-lg">{emoji.emoji}</span>
                        <span className="truncate">{emoji.label}</span>
                      </>
                    ) : (
                      <span>이모지를 고르면 입력칸에 들어갑니다.</span>
                    )
                  }
                </Picker.ActiveEmoji>
              </div>
            </Picker.Root>
          </div>,
          document.body,
        )}
    </>
  );
}
