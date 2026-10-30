"use client";

import { Spinner } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import { fileIconOf, formatFileSize, MAX_ATTACHMENT_COUNT } from "@/lib/attachment-files";
import { AlertCircle, Send, X } from "lucide-react";

// 보내기 전 첨부 한 개. progress가 null이면 대기, 숫자면 올리는 중(%), error가 있으면 실패.
export type PendingAttachment = {
  key: string;
  file: File;
  // 사진이면 미리보기용 주소(내 컴퓨터의 파일을 바로 보여 줌).
  previewUrl: string | null;
  progress: number | null;
  error: string | null;
};

// 입력창 위에 뜨는 첨부 미리보기 칸. 사진은 썸네일, 파일은 카드로 보여 주고 X로 뺄 수 있음.
export function AttachmentTray({
  items,
  sending,
  onRemove,
  onClear,
  onSend,
}: {
  items: PendingAttachment[];
  sending: boolean;
  onRemove: (key: string) => void;
  onClear: () => void;
  onSend: () => void;
}) {
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  return (
    <div className="rounded-t-2xl border border-slate-200 bg-white px-4 pb-3 pt-2.5">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <span>
          첨부 <b className="text-blue-600">{items.length}</b>/{MAX_ATTACHMENT_COUNT}개 ·{" "}
          {formatFileSize(totalSize)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={sending}
            onClick={onClear}
            className="cursor-pointer rounded-md px-2 py-1 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            모두 빼기
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={onSend}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {sending ? <Spinner size={12} /> : <Send size={12} aria-hidden="true" />}
            {sending ? "보내는 중" : "보내기"}
          </button>
        </span>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const { Icon, className: iconClassName } = fileIconOf(item.file.name);
          const uploading = item.progress !== null;
          return (
            <li
              key={item.key}
              className={`group/tray relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl border ${item.error ? "border-red-300" : "border-slate-200"} bg-slate-50`}
            >
              {item.previewUrl ? (
                // 내 컴퓨터의 파일을 바로 보여 주는 임시 주소라 next/image 대상이 아님.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="line-clamp-2 w-full break-all text-[11px] leading-tight text-slate-700">
                    {item.file.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatFileSize(item.file.size)}
                  </span>
                </span>
              )}
              {/* 올리는 중이면 아래쪽에 진행 막대와 퍼센트. */}
              {uploading && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/70 text-[11px] font-semibold text-blue-600">
                  <Spinner size={16} className="text-blue-500" />
                  {item.progress}%
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-slate-200">
                    <span
                      className="block h-full bg-blue-500 transition-[width] duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                </span>
              )}
              {item.error && !uploading && (
                <Tooltip label={item.error} multiline placement="top">
                  <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                    <AlertCircle size={13} aria-label={item.error} />
                  </span>
                </Tooltip>
              )}
              {!uploading && (
                <button
                  type="button"
                  aria-label={`${item.file.name} 빼기`}
                  disabled={sending}
                  onClick={() => onRemove(item.key)}
                  className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900/60 text-white opacity-80 transition hover:bg-slate-900/80 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
