"use client";

import { AttachmentImage } from "@/components/chat/attachment-image";
import { Spinner } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import { useDownloadButton } from "@/hooks/use-attachment";
import type { ChatAttachment } from "@/lib/api/chat-api";
import { formatFileSize } from "@/lib/attachment-files";
import { ChevronLeft, ChevronRight, Download, MessageSquareText, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

// 크게 볼 사진 한 장과 그 사진이 달린 메시지 정보.
export type ViewerImage = {
  attachment: ChatAttachment;
  messageId: number;
  senderName: string;
  createdAt: string;
};

const dateTimeLabel = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// 사진 크게 보기. 사진에 집중하도록 이 화면만 예외로 어두운 배경을 씀.
// ←/→ 키나 양옆 버튼으로 이전·다음 사진, Esc나 바깥 클릭으로 닫기.
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
  onDownload,
  onOpenMessage,
}: {
  images: ViewerImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDownload: (attachment: ChatAttachment) => Promise<void>;
  // 있으면 "대화에서 보기" 버튼으로 해당 메시지 위치로 이동.
  onOpenMessage?: (messageId: number) => void;
}) {
  const current = images[index];
  const hasPrevious = index > 0;
  const hasNext = index < images.length - 1;
  const downloadCurrent = useCallback(
    () => (current ? onDownload(current.attachment) : Promise.resolve()),
    [current, onDownload],
  );
  const { downloading, start } = useDownloadButton(downloadCurrent);

  useEffect(() => {
    // 뒤에 열린 패널·입력창의 Esc 처리보다 먼저 받아 사진 뷰어만 닫히게 함.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && hasPrevious) onIndexChange(index - 1);
      else if (event.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [hasNext, hasPrevious, index, onClose, onIndexChange]);

  if (!current) return null;
  const navButton =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95";
  const toolButton =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white active:scale-95";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      className="fixed inset-0 z-[130] flex flex-col bg-slate-950/90 text-white animate-in fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{current.senderName}</p>
          <p className="truncate text-xs text-slate-400">{dateTimeLabel(current.createdAt)}</p>
        </div>
        <span className="ml-auto text-sm tabular-nums text-slate-300">
          {index + 1} / {images.length}
        </span>
        <div className="flex items-center gap-1">
          {onOpenMessage && (
            <Tooltip label="대화에서 보기">
              <button
                type="button"
                aria-label="대화에서 보기"
                onClick={() => {
                  onClose();
                  onOpenMessage(current.messageId);
                }}
                className={toolButton}
              >
                <MessageSquareText size={20} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={downloading ? "내려받는 중" : "내려받기"}>
            <button
              type="button"
              aria-label="사진 내려받기"
              aria-busy={downloading}
              onClick={() => void start()}
              className={toolButton}
            >
              {downloading ? <Spinner size={20} /> : <Download size={20} aria-hidden="true" />}
            </button>
          </Tooltip>
          <Tooltip label="닫기 (Esc)">
            <button type="button" aria-label="닫기" onClick={onClose} className={toolButton}>
              <X size={22} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </header>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-20 pb-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {hasPrevious && (
          <button
            type="button"
            aria-label="이전 사진"
            onClick={() => onIndexChange(index - 1)}
            className={`${navButton} left-5`}
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
        )}
        <AttachmentImage
          key={current.attachment.id}
          attachment={current.attachment}
          tone="dark"
          className="h-full w-full"
          imageClassName="max-h-full max-w-full object-contain select-none"
        />
        {hasNext && (
          <button
            type="button"
            aria-label="다음 사진"
            onClick={() => onIndexChange(index + 1)}
            className={`${navButton} right-5`}
          >
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        )}
      </div>
      <footer className="shrink-0 pb-5 text-center text-xs text-slate-400">
        {current.attachment.name} · {formatFileSize(current.attachment.size)}
      </footer>
    </div>,
    document.body,
  );
}
