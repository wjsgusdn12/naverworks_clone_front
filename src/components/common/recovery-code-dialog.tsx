"use client";

import { Check, Copy, KeyRound, X } from "lucide-react";
import { useEffect, useState } from "react";

// 복구 코드를 한 번 보여 주는 대화상자. 가입 직후와 내 프로필의 재발급에서 함께 사용.
type RecoveryCodeDialogProps = {
  code: string;
  title: string;
  description: string;
  confirmLabel: string;
  // 코드 아래 작은 안내문. 초대 코드처럼 다른 문구가 필요하면 바꿈.
  note?: string;
  // 있으면 "새로 발급" 버튼을 보여 줌(초대 코드·복구 코드 재발급).
  onRegenerate?: () => void;
  onClose: () => void;
};

export function RecoveryCodeDialog({
  code,
  title,
  description,
  confirmLabel,
  note = "이 코드는 지금만 보입니다. 잃어버리면 로그인 후 내 프로필에서 새로 발급할 수 있습니다.",
  onRegenerate,
  onClose,
}: RecoveryCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  // Esc로 닫기.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없으면 사용자가 직접 드래그해 복사할 수 있게 둠.
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-code-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <h2 id="recovery-code-title" className="text-lg font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <code className="flex-1 select-all text-center font-mono text-lg font-bold tracking-widest text-slate-900">
            {code}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition ${copied ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"}`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">{note}</p>
        <div className="mt-5 flex gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="h-11 flex-1 cursor-pointer rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              새로 발급
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 cursor-pointer rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
