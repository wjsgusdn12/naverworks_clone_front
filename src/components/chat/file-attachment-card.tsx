"use client";

import { Spinner } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import { useDownloadButton } from "@/hooks/use-attachment";
import type { ChatAttachment } from "@/lib/api/chat-api";
import { fileIconOf, filePreviewOf, formatFileSize } from "@/lib/attachment-files";
import { Download, Eye } from "lucide-react";
import type { ReactNode } from "react";

// 일반 파일 첨부 카드: 형식별 아이콘, 이름, 크기, 내려받기 버튼. 말풍선과 모아보기 목록 공용.
// onOpen이 있으면 카드를 눌러 미리보기 모달을 열 수 있음.
export function FileAttachmentCard({
  attachment,
  onDownload,
  onOpen,
  detail,
  className = "",
}: {
  attachment: Pick<ChatAttachment, "id" | "name" | "size">;
  onDownload: () => Promise<void>;
  onOpen?: () => void;
  // 크기 옆에 덧붙일 정보(모아보기의 보낸 사람·날짜 등).
  detail?: ReactNode;
  className?: string;
}) {
  const { Icon, className: iconClassName } = fileIconOf(attachment.name);
  const { downloading, start } = useDownloadButton(onDownload);
  const previewable = filePreviewOf(attachment.name) !== null;
  const iconButton =
    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 active:scale-95";
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `${attachment.name} 미리보기` : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen || event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
      className={`flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${onOpen ? "cursor-pointer transition hover:border-blue-200 hover:bg-blue-50/40" : ""} ${className}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {formatFileSize(attachment.size)}
          {detail}
        </span>
      </span>
      {onOpen && previewable && (
        <Tooltip label="미리보기" placement="top">
          <button
            type="button"
            aria-label={`${attachment.name} 미리보기`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className={iconButton}
          >
            <Eye size={17} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      <Tooltip label={downloading ? "내려받는 중" : "내려받기"} placement="top">
        <button
          type="button"
          aria-label={`${attachment.name} 내려받기`}
          aria-busy={downloading}
          onClick={(event) => {
            event.stopPropagation();
            void start();
          }}
          className={iconButton}
        >
          {downloading ? (
            <Spinner size={17} className="text-blue-500" />
          ) : (
            <Download size={17} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
