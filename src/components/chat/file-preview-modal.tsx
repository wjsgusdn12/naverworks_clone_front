"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { LoadingState, Spinner } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import { useDownloadButton } from "@/hooks/use-attachment";
import { chatApi, type ChatAttachment } from "@/lib/api/chat-api";
import {
  extensionOf,
  fileIconOf,
  filePreviewOf,
  formatFileSize,
  TEXT_PREVIEW_MAX,
} from "@/lib/attachment-files";
import { Download, FileQuestion, MessageSquareText, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 미리보기로 열 파일 한 개와 그 파일이 달린 메시지 정보.
export type PreviewFile = {
  attachment: ChatAttachment;
  messageId: number;
  senderName: string;
  createdAt: string;
};

type Content =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "unsupported"; reason: string }
  | { status: "text"; text: string }
  | { status: "url"; url: string };

// UTF-8로 먼저 읽고, 깨지면 한글 윈도우 형식(EUC-KR)으로 다시 읽음.
const decodeText = (buffer: ArrayBuffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
};

// 파일 미리보기 모달. PDF·글자·동영상·음성은 화면에서 바로 열고, 그 밖의 형식은 안내와 내려받기만.
export function FilePreviewModal({
  file,
  onClose,
  onDownload,
  onOpenMessage,
}: {
  file: PreviewFile;
  onClose: () => void;
  onDownload: (attachment: ChatAttachment) => Promise<void>;
  onOpenMessage?: (messageId: number) => void;
}) {
  const { accessToken } = useAuth();
  const { attachment } = file;
  const preview = filePreviewOf(attachment.name);
  const tooLargeText = preview?.kind === "text" && attachment.size > TEXT_PREVIEW_MAX;
  const [content, setContent] = useState<Content>(
    !preview
      ? {
          status: "unsupported",
          reason: `[미리보기 미지원] 형식 ${extensionOf(attachment.name).toUpperCase() || "알 수 없음"}`,
        }
      : tooLargeText
        ? { status: "unsupported", reason: "[미리보기 불가] 글자 파일 2MB 초과" }
        : { status: "loading" },
  );
  const download = useCallback(() => onDownload(attachment), [attachment, onDownload]);
  const { downloading, start } = useDownloadButton(download);

  useEffect(() => {
    if (!accessToken || !preview || tooLargeText) return;
    let alive = true;
    let objectUrl: string | null = null;
    chatApi
      .attachmentBlob(accessToken, attachment.id, false)
      .then(async (blob) => {
        if (preview.kind === "text") {
          const text = decodeText(await blob.arrayBuffer());
          if (alive) setContent({ status: "text", text });
          return;
        }
        // 서버는 다운로드 형식으로 주므로 확장자에 맞는 형식을 붙여야 브라우저가 열 수 있음.
        objectUrl = URL.createObjectURL(new Blob([blob], { type: preview.mime }));
        if (alive) setContent({ status: "url", url: objectUrl });
      })
      .catch((error: Error) => {
        if (alive) setContent({ status: "failed", message: error.message });
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // 같은 파일이면 다시 받지 않음(preview는 파일 이름으로 정해져 attachment.id에 따라감).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, attachment.id]);

  useEffect(() => {
    // 뒤에 열린 패널·입력창의 Esc 처리보다 먼저 받아 이 모달만 닫히게 함.
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", closeByEscape, true);
    return () => window.removeEventListener("keydown", closeByEscape, true);
  }, [onClose]);

  const { Icon, className: iconClassName } = fileIconOf(attachment.name);
  const toolButton =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95";
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${attachment.name} 미리보기`}
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900" title={attachment.name}>
              {attachment.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {formatFileSize(attachment.size)} · {file.senderName} ·{" "}
              {new Date(file.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
          {onOpenMessage && (
            <Tooltip label="대화에서 보기">
              <button
                type="button"
                aria-label="대화에서 보기"
                onClick={() => {
                  onClose();
                  onOpenMessage(file.messageId);
                }}
                className={toolButton}
              >
                <MessageSquareText size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={downloading ? "내려받는 중" : "내려받기"}>
            <button
              type="button"
              aria-label="내려받기"
              aria-busy={downloading}
              onClick={() => void start()}
              className={toolButton}
            >
              {downloading ? (
                <Spinner size={18} className="text-blue-500" />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          <Tooltip label="닫기 (Esc)">
            <button type="button" aria-label="닫기" onClick={onClose} className={toolButton}>
              <X size={20} aria-hidden="true" />
            </button>
          </Tooltip>
        </header>
        <div className="min-h-0 flex-1 bg-slate-50">
          {content.status === "loading" ? (
            <LoadingState message="파일을 불러오는 중입니다..." size="md" className="h-full" />
          ) : content.status === "failed" || content.status === "unsupported" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
              <FileQuestion size={36} className="text-slate-300" aria-hidden="true" />
              <p className="font-medium text-slate-600">
                {content.status === "failed"
                  ? `[불러오기 실패] ${content.message}`
                  : content.reason}
              </p>
              <button
                type="button"
                onClick={() => void start()}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                {downloading ? <Spinner size={14} /> : <Download size={14} aria-hidden="true" />}
                내려받아 확인
              </button>
            </div>
          ) : content.status === "text" ? (
            // React가 글자를 그대로 넣으므로 HTML 파일이어도 실행되지 않음.
            <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-6 text-slate-800">
              {content.text}
            </pre>
          ) : preview?.kind === "pdf" ? (
            <iframe src={content.url} title={attachment.name} className="h-full w-full" />
          ) : preview?.kind === "video" ? (
            <div className="flex h-full items-center justify-center bg-slate-900">
              <video src={content.url} controls className="max-h-full max-w-full" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <audio src={content.url} controls className="w-[min(480px,90%)]" />
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
