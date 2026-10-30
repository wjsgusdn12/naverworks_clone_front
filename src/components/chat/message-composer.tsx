"use client";

import { AttachmentTray, type PendingAttachment } from "@/components/chat/attachment-tray";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { MessageQuote } from "@/components/chat/message-quote";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { Tooltip } from "@/components/common/tooltip";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ChatMessage } from "@/lib/api/chat-api";
import { IMAGE_ACCEPT } from "@/lib/attachment-files";
import {
  DEFAULT_INPUT_HEIGHT,
  MAX_INPUT_HEIGHT,
  MIN_INPUT_HEIGHT,
  clampInputHeight,
} from "@/lib/chat-input-height";
import { AtSign, ImagePlus, Paperclip, Pencil, Reply, SmilePlus, X } from "lucide-react";
import { type Dispatch, type FormEvent, type RefObject, type SetStateAction, useRef } from "react";

type MentionCandidate = {
  membershipId: number;
  displayName: string;
  jobGradeName: string | null;
  departmentName: string | null;
};

// 하단 메시지 입력창: 높이 조절 손잡이, 답장·수정 미리보기, 텍스트 영역, 멘션 자동완성, 첨부 버튼.
// 입력값·답장·수정·멘션 상태는 page가 가지고 값·콜백만 내려받음.
export function MessageComposer({
  composerRef,
  inputRef,
  input,
  inputHeight,
  replyTarget,
  editingTarget,
  contactMemberById,
  myMembershipId,
  mentionStartIndex,
  mentionHighlightIndex,
  visibleMentionCandidates,
  onSubmit,
  onInput,
  onResizeInput,
  onSaveInputHeight,
  onCancelReply,
  onCancelEdit,
  onMentionHighlightIndexChange,
  onCloseMention,
  onSelectMention,
  onProfileClick,
  showToast,
  pendingAttachments,
  attachmentSending,
  onAddFiles,
  onRemoveAttachment,
  onClearAttachments,
}: {
  composerRef: RefObject<HTMLFormElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  inputHeight: number;
  replyTarget: ChatMessage | undefined;
  editingTarget: ChatMessage | null;
  contactMemberById: Map<number, AddressBookMember>;
  myMembershipId: number | undefined;
  mentionStartIndex: number | null;
  mentionHighlightIndex: number;
  visibleMentionCandidates: MentionCandidate[];
  onSubmit: (event?: FormEvent) => Promise<void>;
  onInput: (value: string, cursorPosition?: number) => void;
  onResizeInput: (height: number) => void;
  onSaveInputHeight: (height: number) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onMentionHighlightIndexChange: Dispatch<SetStateAction<number>>;
  onCloseMention: () => void;
  onSelectMention: (candidate: { membershipId: number; displayName: string }) => void;
  onProfileClick: (membershipId: number) => void;
  showToast: (message: string) => void;
  // 보내기 전 첨부 목록과 올리는 중 여부. 추가·빼기는 page가 검사(개수·크기)한 뒤 반영.
  pendingAttachments: PendingAttachment[];
  attachmentSending: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (key: string) => void;
  onClearAttachments: () => void;
}) {
  // 본인 아바타 배지에 쓰는 내 상태 설정.
  const { myStatusType } = useChatNotification();
  const inputResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      ref={composerRef}
      onSubmit={onSubmit}
      className="relative mx-4 my-3 rounded-2xl bg-slate-100 pb-4"
    >
      {/* 입력창 위쪽 손잡이를 위아래로 끌거나 방향키로 높이 조절, 더블클릭하면 기본 높이로 복원. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="메시지 입력창 높이 조절"
        aria-valuemin={MIN_INPUT_HEIGHT}
        aria-valuemax={MAX_INPUT_HEIGHT}
        aria-valuenow={inputHeight}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          inputResizeRef.current = { startY: event.clientY, startHeight: inputHeight };
        }}
        onPointerMove={(event) => {
          const drag = inputResizeRef.current;
          if (drag) onResizeInput(drag.startHeight + drag.startY - event.clientY);
        }}
        onPointerUp={() => {
          if (!inputResizeRef.current) return;
          inputResizeRef.current = null;
          onSaveInputHeight(inputHeight);
        }}
        onDoubleClick={() => {
          onResizeInput(DEFAULT_INPUT_HEIGHT);
          onSaveInputHeight(DEFAULT_INPUT_HEIGHT);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const next = clampInputHeight(inputHeight + (event.key === "ArrowUp" ? 16 : -16));
          onResizeInput(next);
          onSaveInputHeight(next);
        }}
        className="group absolute inset-x-6 -top-2.5 z-10 flex h-5 cursor-row-resize touch-none items-center justify-center outline-none"
      >
        <span className="h-1 w-10 rounded-full bg-slate-300 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-visible:bg-blue-500 group-focus-visible:opacity-100 group-active:bg-blue-500 group-active:opacity-100" />
      </div>
      {pendingAttachments.length > 0 && (
        <AttachmentTray
          items={pendingAttachments}
          sending={attachmentSending}
          onRemove={onRemoveAttachment}
          onClear={onClearAttachments}
          onSend={() => void onSubmit()}
        />
      )}
      {replyTarget && (
        <div className="message-action-menu flex items-center gap-3 rounded-t-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            {/* 수정 바와 같은 자리에 같은 모양의 제목 딱지. */}
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-600">
              <Reply size={12} aria-hidden="true" />
              메시지 답장
            </p>
            <MessageQuote
              reply={{
                messageId: replyTarget.id,
                senderName: replyTarget.senderName,
                content: replyTarget.content,
              }}
              avatar={
                <MessageMemberAvatar
                  name={replyTarget.senderName}
                  presenceStatus={
                    contactMemberById.get(replyTarget.senderMembershipId)?.presenceStatus ??
                    (replyTarget.senderMembershipId === myMembershipId ? "ONLINE" : "OFFLINE")
                  }
                  statusType={
                    replyTarget.senderMembershipId === myMembershipId
                      ? myStatusType
                      : contactMemberById.get(replyTarget.senderMembershipId)?.statusType
                  }
                  onClick={() => onProfileClick(replyTarget.senderMembershipId)}
                />
              }
            />
          </div>
          <Tooltip label="답장 취소" placement="top">
            <button
              type="button"
              aria-label="답장 취소"
              onClick={onCancelReply}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 active:scale-90"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
      {/* 수정 중 표시: 답장 바와 같은 자리·같은 모양에 원문을 보여 주고, X로 취소. */}
      {editingTarget && (
        <div className="message-action-menu flex items-center gap-3 rounded-t-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-600">
              <Pencil size={12} aria-hidden="true" />
              메시지 수정
            </p>
            <MessageQuote
              reply={{
                messageId: editingTarget.id,
                senderName: editingTarget.senderName,
                content: editingTarget.content,
              }}
              avatar={
                <MessageMemberAvatar
                  name={editingTarget.senderName}
                  presenceStatus="ONLINE"
                  statusType={myStatusType}
                />
              }
            />
          </div>
          <Tooltip label="수정 취소" placement="top">
            <button
              type="button"
              aria-label="수정 취소"
              onClick={onCancelEdit}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 active:scale-90"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
      <div className="relative">
        {replyTarget && (
          <Reply
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
          />
        )}
        {editingTarget && (
          <Pencil
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
          />
        )}
        <textarea
          ref={inputRef}
          value={input}
          maxLength={2000}
          onChange={(event) =>
            onInput(event.target.value, event.target.selectionStart ?? event.target.value.length)
          }
          onPaste={(event) => {
            // 복사한 사진·파일을 붙여넣으면 글자 대신 첨부로 추가.
            const files = Array.from(event.clipboardData.files);
            if (files.length === 0) return;
            event.preventDefault();
            onAddFiles(files);
          }}
          onKeyDown={(event) => {
            // 한글 조합 확정 Enter를 전송으로 오인하지 않음.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (mentionStartIndex !== null && visibleMentionCandidates.length > 0) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                onMentionHighlightIndexChange(
                  (current) =>
                    (event.key === "ArrowDown"
                      ? current + 1
                      : current - 1 + visibleMentionCandidates.length) %
                    visibleMentionCandidates.length,
                );
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                onSelectMention(
                  visibleMentionCandidates[mentionHighlightIndex] ?? visibleMentionCandidates[0],
                );
                return;
              }
              if (event.key === "Escape") {
                onCloseMention();
                return;
              }
            }
            if (event.key === "Escape" && editingTarget) {
              onCancelEdit();
              return;
            }
            if (event.key === "Escape" && replyTarget) {
              onCancelReply();
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={
            editingTarget
              ? "수정할 내용을 입력해주세요. (Enter: 저장 / Esc: 취소)"
              : "메시지를 입력해주세요. (Enter: 전송 / Shift + Enter: 줄바꿈)"
          }
          style={{ height: inputHeight }}
          className={`w-full resize-none bg-transparent pr-4 pt-3 text-sm outline-none ${replyTarget || editingTarget ? "pl-10" : "pl-4"}`}
        />
      </div>
      {mentionStartIndex !== null && visibleMentionCandidates.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-5 z-30 max-h-72 w-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {visibleMentionCandidates.map((candidate, index) => (
            <button
              key={candidate.membershipId}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelectMention(candidate)}
              className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition ${index === mentionHighlightIndex ? "bg-blue-50" : "hover:bg-slate-50"}`}
            >
              {candidate.membershipId === -1 ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm text-blue-600">
                  <AtSign size={18} />
                </span>
              ) : (
                <MessageMemberAvatar
                  name={candidate.displayName}
                  presenceStatus={
                    contactMemberById.get(candidate.membershipId)?.presenceStatus ?? "OFFLINE"
                  }
                  statusType={contactMemberById.get(candidate.membershipId)?.statusType}
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">
                  @{candidate.displayName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {candidate.jobGradeName || candidate.departmentName || "구성원"}
                  {candidate.membershipId === -1 ? "" : ` · ${candidate.departmentName ?? ""}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {/* 파일 선택 창만 쓰는 숨은 입력칸. 화면에는 아래 아이콘 버튼만 보임. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAddFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        hidden
        accept={IMAGE_ACCEPT}
        onChange={(event) => {
          onAddFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-3 px-4 text-slate-600">
        <Tooltip label="파일 첨부" placement="top">
          <button
            type="button"
            aria-label="파일 첨부"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer transition hover:text-blue-600"
          >
            <Paperclip size={19} />
          </button>
        </Tooltip>
        <Tooltip label="사진 첨부" placement="top">
          <button
            type="button"
            aria-label="사진 첨부"
            onClick={() => imageInputRef.current?.click()}
            className="cursor-pointer transition hover:text-blue-600"
          >
            <ImagePlus size={19} />
          </button>
        </Tooltip>
        <button
          type="button"
          aria-label="이모지"
          onClick={() => showToast("이모지 기능은 준비 중입니다.")}
          className="cursor-pointer transition hover:text-blue-600"
        >
          <SmilePlus size={19} />
        </button>
      </div>
    </form>
  );
}
