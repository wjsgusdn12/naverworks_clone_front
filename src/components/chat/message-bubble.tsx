"use client";

import { MentionText } from "@/components/chat/mention-text";
import {
  MENU_HEIGHT_MINE,
  MENU_HEIGHT_OTHERS,
  MessageActionMenu,
  REACTION_EXPIRED_MESSAGE,
  type MessageMenuPosition,
} from "@/components/chat/message-action-menu";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { MessageQuote } from "@/components/chat/message-quote";
import { ReactionEmoji } from "@/components/chat/reaction-emoji";
import { ReactionPicker } from "@/components/chat/reaction-picker";
import { Tooltip } from "@/components/common/tooltip";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import type { ChatMessage } from "@/lib/api/chat-api";
import { isMessageEditable } from "@/lib/chat-page-helpers";
import { reactionLabel } from "@/lib/chat-reactions";
import { ChevronLeft, ChevronRight, Forward } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

// 말풍선 하나는 자기 props가 바뀔 때만 다시 그림(목록 안에서 다른 말풍선이 바뀌어도 영향 없음).
export const MessageBubble = memo(function MessageBubble({
  message,
  isOriginalHighlighted,
  isMine,
  isDirect,
  isGroup,
  senderProfile,
  showSender,
  showMeta,
  showTail,
  onOpenReadMembers,
  onProfileClick,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  onOpenOriginal,
  onToggleReaction,
  onOpenReactionMembers,
  onForward,
  onToggleNotice,
  isNotice,
}: {
  message: ChatMessage;
  isOriginalHighlighted: boolean;
  isMine: boolean;
  isDirect: boolean;
  isGroup: boolean;
  senderProfile?: AddressBookMember;
  showSender: boolean;
  showMeta: boolean;
  showTail: boolean;
  onOpenReadMembers: (message: ChatMessage) => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  onCopy: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onOpenOriginal: (messageId: number) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onOpenReactionMembers: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onToggleNotice: (message: ChatMessage) => void;
  isNotice: boolean;
}) {
  // ⋮ 클릭과 말풍선 우클릭이 같은 메뉴·닫기 동작을 공유.
  const [menuPosition, setMenuPosition] = useState<MessageMenuPosition | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!isOriginalHighlighted || !bubble) return;
    // 두 번 통통 튄 뒤 원래 자리로 복귀. 테두리 상태는 별도로 유지.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = bubble.animate(
      reducedMotion
        ? [{ opacity: 0.6 }, { opacity: 1 }]
        : [
            { transform: "translateY(0)", offset: 0 },
            { transform: "translateY(-10px)", offset: 0.25 },
            { transform: "translateY(0)", offset: 0.5 },
            { transform: "translateY(-5px)", offset: 0.75 },
            { transform: "translateY(0)", offset: 1 },
          ],
      { duration: reducedMotion ? 250 : 1150, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [isOriginalHighlighted]);
  const time = new Date(message.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  // 그룹방은 발신자와 관계없이 모든 일반 메시지의 실제 읽음 상태를 표시.
  const readLabel = message.deletedAt ? null : isMine && isDirect && message.unreadCount === 0 ? (
    <span className="mb-0.5 text-[12px] font-medium text-blue-600">읽음</span>
  ) : isGroup && message.readCount > 0 ? (
    <button
      className="mb-0.5 inline-flex cursor-pointer items-center gap-0.5 text-[12px] font-medium text-blue-600 transition hover:underline"
      onClick={() => void onOpenReadMembers(message)}
    >
      {isMine ? <ChevronLeft size={12} strokeWidth={2} /> : null}읽음 {message.readCount}
      {!isMine ? <ChevronRight size={12} strokeWidth={2} /> : null}
    </button>
  ) : null;
  // 읽음은 메시지별 상태라 매 말풍선에 표시하고, 시간만 같은 분 묶음의 마지막에 표시.
  const meta =
    readLabel || showMeta ? (
      <div
        className={`flex shrink-0 flex-col text-[12px] text-slate-400 ${isMine ? "items-end text-right" : "items-start text-left"}`}
      >
        {readLabel}
        {showMeta ? <span>{time}</span> : null}
      </div>
    ) : null;
  const reactions = message.deletedAt ? [] : (message.reactions ?? []);
  const messageMenu = message.deletedAt ? (
    <span aria-hidden="true" className="h-5 w-6 shrink-0" />
  ) : (
    <MessageActionMenu
      isMine={isMine}
      canEdit={isMessageEditable(message)}
      isNotice={isNotice}
      position={menuPosition}
      onPositionChange={setMenuPosition}
      onCopy={() => onCopy(message)}
      onReply={() => onReply(message)}
      onForward={() => onForward(message)}
      onToggleNotice={() => onToggleNotice(message)}
      onEdit={() => onEdit(message)}
      onDelete={() => onDelete(message)}
    />
  );
  // 시간과 ⋮ 사이의 스마일 버튼. 누르면 이모지 선택창이 뜨고, 이미 누른 게 있으면 색칠됨.
  const reactionButton = message.deletedAt ? null : (
    <ReactionPicker
      isMine={isMine}
      reactedEmojis={reactions
        .filter((reaction) => reaction.reactedByMe)
        .map((reaction) => reaction.emoji)}
      expiredMessage={isMessageEditable(message) ? null : REACTION_EXPIRED_MESSAGE}
      onReact={(emoji) => onToggleReaction(message, emoji)}
    />
  );
  // 말풍선 바로 아래 한 줄: 리액션 묶음 + "수정됨". 추가·취소는 스마일 버튼에서, 칩을 클릭하면 누른 사람 목록.
  const underBubble =
    reactions.length > 0 || message.editedAt ? (
      <div
        className={`pointer-events-none absolute top-full flex items-center gap-1 whitespace-nowrap ${isMine ? "right-1 flex-row-reverse" : "left-1"}`}
      >
        {message.editedAt && <span className="text-xs leading-4 text-slate-500">수정됨</span>}
        {reactions.map((reaction) => (
          <Tooltip
            key={reaction.emoji}
            label={`${reactionLabel(reaction.emoji)} ${reaction.count}명 · 클릭: 누른 사람 보기`}
          >
            <button
              type="button"
              aria-label={`${reactionLabel(reaction.emoji)} ${reaction.count}명${reaction.reactedByMe ? ", 내가 누름" : ""}. 누른 사람 보기`}
              onClick={() => onOpenReactionMembers(message)}
              className={`pointer-events-auto flex h-7 cursor-pointer items-center gap-0.5 rounded px-1 text-[15px] transition hover:bg-slate-100 active:scale-95 ${reaction.reactedByMe ? "font-bold" : "font-medium"}`}
            >
              <ReactionEmoji code={reaction.emoji} size={20} />
              <span className="tabular-nums text-blue-600">{reaction.count}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    ) : null;
  // 시간과 메뉴의 밑선을 맞추고, 메뉴가 숨겨져도 공간을 유지해 말풍선 흔들림 방지.
  const messageActions = (
    <div className="flex shrink-0 items-end gap-1 pb-1">
      {isMine ? (
        <>
          {messageMenu}
          {reactionButton}
          {meta}
        </>
      ) : (
        <>
          {meta}
          {reactionButton}
          {messageMenu}
        </>
      )}
    </div>
  );
  // 꼬리는 프로필 쪽을 향하는 위쪽 대각선의 직각삼각형으로 표현.
  const reply = message.deletedAt ? null : message.reply;
  // 말풍선 아래 줄(리액션·수정됨)이 있으면 그 높이만큼 아래 여백을 늘려 다음 메시지와 겹치지 않게 처리.
  const rowSpacing =
    reactions.length > 0 ? "mb-9" : message.editedAt ? "mb-6" : showMeta ? "mb-2" : "mb-1";
  const bubble = (
    <div
      ref={bubbleRef}
      data-message-bubble
      onContextMenu={(event) => {
        // 브라우저 기본 메뉴를 막고 커서 위치에 메시지 메뉴를 표시.
        event.preventDefault();
        event.stopPropagation();
        if (message.deletedAt) return;
        setMenuPosition({
          left: Math.max(8, Math.min(event.clientX, window.innerWidth - 152)),
          top: Math.max(
            8,
            Math.min(
              event.clientY,
              window.innerHeight - (isMine ? MENU_HEIGHT_MINE : MENU_HEIGHT_OTHERS),
            ),
          ),
        });
      }}
      className={`relative min-w-0 ${isGroup && !isMine ? "max-w-full" : "max-w-[70%]"} whitespace-pre-wrap break-words ${reply ? "w-[380px]" : "px-4 py-3"} text-sm leading-6 ${isMine ? "rounded-2xl bg-blue-100" : "rounded-2xl bg-slate-100"} ${showTail ? (isMine ? "after:absolute after:-right-2 after:top-3 after:h-3 after:w-3 after:bg-blue-100 after:[clip-path:polygon(0_0,0_100%,100%_0)]" : "after:absolute after:-left-2 after:top-3 after:h-3 after:w-3 after:bg-slate-100 after:[clip-path:polygon(100%_0,100%_100%,0_0)]") : ""}`}
    >
      {/* 꼬리 가상 요소보다 앞에 테두리를 그려 접점에서도 파란 선이 가려지지 않게 처리. */}
      {isOriginalHighlighted && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            borderRadius: "inherit",
            outline: "2px solid #3b82f6",
            outlineOffset: "0px",
          }}
        />
      )}
      {reply && <MessageQuote reply={reply} onOpen={() => onOpenOriginal(reply.messageId)} />}
      {/* 다른 방에서 전달해 온 메시지는 본문 위에 작은 라벨로 표시. */}
      {message.forwarded && !message.deletedAt && (
        <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <Forward size={12} aria-hidden="true" />
          전달된 메시지
        </span>
      )}
      {reply ? (
        <div className="px-3 py-2">
          <MentionText content={message.content} />
          {underBubble}
        </div>
      ) : message.deletedAt ? (
        <span className="text-slate-400 italic">{message.content}</span>
      ) : (
        <>
          <MentionText content={message.content} />
          {underBubble}
        </>
      )}
    </div>
  );
  if (!isMine && isGroup) {
    // 그룹방 제3자 메시지는 프로필을 기준으로 말풍선 꼬리가 왼쪽을 향하게 배치.
    return (
      <div className={`${rowSpacing} flex items-start gap-2`}>
        {showSender ? (
          <span className="mt-3 w-10 shrink-0">
            <MessageMemberAvatar
              name={senderProfile?.displayName ?? message.senderName}
              presenceStatus={senderProfile?.presenceStatus ?? "OFFLINE"}
              onClick={() => onProfileClick(message.senderMembershipId)}
            />
          </span>
        ) : (
          <span className="w-10 shrink-0" />
        )}
        <div className="min-w-0 max-w-[70%]">
          {showSender && (
            <button
              type="button"
              onClick={() => onProfileClick(message.senderMembershipId)}
              className="mt-3 cursor-pointer text-left text-sm font-bold transition hover:text-blue-600"
            >
              {senderProfile?.displayName ?? message.senderName}
            </button>
          )}
          <div className={`${showSender ? "mt-1" : ""} flex items-end gap-2`}>
            {bubble}
            {messageActions}
          </div>
        </div>
      </div>
    );
  }
  // 내 말풍선은 시간→말풍선, 상대 말풍선은 말풍선→시간 순서.
  return (
    <div className={`${rowSpacing} ${isMine ? "ml-auto" : "mr-auto"} max-w-[85%]`}>
      <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
        {isMine ? (
          <>
            {messageActions}
            {bubble}
          </>
        ) : (
          <>
            {bubble}
            {messageActions}
          </>
        )}
      </div>
    </div>
  );
});
