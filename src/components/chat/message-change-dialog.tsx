"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/api/chat-api";

type DialogShellProps = { title: string; onClose: () => void; children: ReactNode; widthClassName?: string };

function MessageDialogShell({ title, onClose, children, widthClassName = "max-w-lg" }: DialogShellProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus());
    // 모달 안에서 키보드 포커스를 순환하고 Esc로 취소.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)") ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className={`message-action-menu w-full ${widthClassName} rounded-xl border border-slate-200 bg-white p-6 shadow-xl`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" aria-label={`${title} 닫기`} onClick={onClose} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

type MessageEditDialogProps = { message: ChatMessage; onClose: () => void; onSave: (content: string) => Promise<void>; onNotice: (text: string) => void };

export function MessageEditDialog({ message, onClose, onSave, onNotice }: MessageEditDialogProps) {
  const [content, setContent] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const save = async () => {
    if (saving) return;
    if (!content.trim() || content.trim().length > 2000) {
      setInvalid(true);
      onNotice("메시지는 1~2,000자로 입력해 주세요.");
      return;
    }
    setSaving(true);
    try { await onSave(content.trim()); onClose(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "메시지를 수정하지 못했습니다."); }
    finally { setSaving(false); }
  };
  return (
    <MessageDialogShell title="메시지 수정" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <textarea data-dialog-initial-focus aria-label="수정할 메시지" aria-invalid={invalid} value={content} maxLength={2000} disabled={saving}
          onChange={(event) => { setContent(event.target.value); setInvalid(false); }}
          onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void save(); } }}
          className={`h-44 w-full resize-none rounded-lg border bg-slate-50 p-3 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${invalid ? "border-red-400" : "border-slate-200 focus:border-blue-400"}`} />
        <div className="mt-2 flex justify-between text-xs text-slate-400"><span>Ctrl+Enter 저장 · Esc 취소</span><span>{content.length} / 2,000</span></div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md border border-slate-200 px-4 py-2 text-sm transition hover:bg-slate-50 active:scale-95">취소</button>
          <button type="submit" disabled={saving} className="flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-wait disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}저장</button>
        </div>
      </form>
    </MessageDialogShell>
  );
}

type MessageDeleteDialogProps = { onClose: () => void; onDelete: () => Promise<void>; onNotice: (text: string) => void };

export function MessageDeleteDialog({ onClose, onDelete, onNotice }: MessageDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try { await onDelete(); onClose(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "메시지를 삭제하지 못했습니다."); }
    finally { setDeleting(false); }
  };
  return (
    <MessageDialogShell title="메시지 삭제" onClose={onClose} widthClassName="max-w-md">
      {/* 확인 모달은 아이콘과 안내 문구를 한 줄로 묶어 시선이 위→아래로 한 번에 흐르게 배치. */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"><Trash2 size={22} /></div>
        <div className="min-w-0 pt-0.5">
          <p className="text-base font-semibold text-slate-800">이 메시지를 삭제할까요?</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">모든 참여자에게 &lsquo;삭제된 메시지입니다.&rsquo;로 표시되며, 되돌릴 수 없습니다.</p>
        </div>
      </div>
      <div className="mt-7 flex justify-end gap-2">
        <button data-dialog-initial-focus type="button" onClick={onClose} className="cursor-pointer rounded-md border border-slate-200 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50 active:scale-95">취소</button>
        <button type="button" onClick={() => void remove()} disabled={deleting} className="flex cursor-pointer items-center gap-2 rounded-md bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95 disabled:cursor-wait disabled:opacity-60">{deleting && <LoaderCircle size={14} className="animate-spin" />}삭제</button>
      </div>
    </MessageDialogShell>
  );
}
