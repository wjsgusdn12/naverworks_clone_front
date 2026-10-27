import type { ChatReply } from "@/lib/api/chat-api";
import { Fragment, type ReactNode } from "react";

// 말풍선의 인용과 입력창 미리보기는 내용을 공유하고 표시 용도에 맞게 구성.
export function MessageQuote({ reply, onOpen, avatar }: { reply: ChatReply; onOpen?: () => void; avatar?: ReactNode }) {
  // 전송된 답장은 원문을 한 줄로 요약하고, 아래 답장 본문과 가로선으로 구분.
  if (onOpen) {
    return (
      <button type="button" aria-label={`${reply.senderName}님의 원문 메시지로 이동`} onClick={onOpen} className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-t-2xl border-b border-slate-300/70 px-3 py-2 text-left transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-blue-500 active:bg-white/40">
        {avatar ?? (
          <span aria-hidden="true" className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-800">
            {reply.senderName.slice(0, 3)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-800">{reply.senderName}</span>
          <span className="block truncate text-xs leading-5 text-slate-500">{reply.content.replace(/[\r\n]+/g, " ")}</span>
        </span>
      </button>
    );
  }
  const content = (
    <>
      <span className="block truncate text-sm font-semibold text-slate-600">{reply.senderName}님에게 답장</span>
      <span className="reply-quote-content mt-0.5 max-h-12 text-sm leading-6 text-slate-500">
        {/* 원문의 줄바꿈을 명시적으로 유지하고, 두 줄 초과분만 CSS로 말줄임. */}
        {reply.content.split(/\r\n|\r|\n/).map((line, index) => (
          <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>
        ))}
      </span>
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}
