import type { ReactNode } from "react";
import { reactionLabel } from "@/lib/chat-reactions";

type ReactionEmojiProps = {
  // 서버에 저장된 이모지 코드(thumbs_up, heart …).
  code: string;
  // 픽셀 단위 크기.
  size?: number;
  className?: string;
};

// 브라우저 기본 이모지 글꼴 대신 프로젝트 전용 SVG 그림을 씀. OS마다 모양이 달라지지 않고 크기 조절이 자유로움.
// 모르는 코드가 오면 회색 동그라미로 자리를 지켜 화면이 깨지지 않게 함.
export function ReactionEmoji({ code, size = 20, className = "" }: ReactionEmojiProps) {
  const art = ART[code] ?? FALLBACK;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={reactionLabel(code)}
      className={`shrink-0 ${className}`}
    >
      {art}
    </svg>
  );
}

// 얼굴형 이모지에 공통으로 쓰는 노란 바탕(살짝 그라데이션으로 입체감).
const face = (
  <>
    <defs>
      <radialGradient id="reaction-face" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="#FFE066" />
        <stop offset="1" stopColor="#F5B400" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="14.5" fill="url(#reaction-face)" />
  </>
);

const ART: Record<string, ReactNode> = {
  thumbs_up: (
    <>
      <path
        d="M4.5 14.5h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z"
        fill="#2F7BF5"
      />
      <path
        d="M11.5 15.2l4.6-8.3c.5-.9 1.5-1.4 2.5-1.1 1.3.3 2 1.6 1.8 2.9L19.6 13h5.6a2.8 2.8 0 0 1 2.7 3.5l-2 8.1a3 3 0 0 1-2.9 2.3H11.5z"
        fill="#FFC83D"
      />
      <path
        d="M11.5 15.2v11.7h11.5a3 3 0 0 0 2.9-2.3l2-8.1a2.8 2.8 0 0 0-.4-2.3c-.1 1.1-.6 2.1-.8 3l-1.6 6.3a2 2 0 0 1-1.9 1.4H13.5v-9.7z"
        fill="#E6A62E"
        opacity=".55"
      />
    </>
  ),
  heart: (
    <>
      <path
        d="M16 28.5S3.5 20.6 3.5 12.3A6.6 6.6 0 0 1 16 8.9a6.6 6.6 0 0 1 12.5 3.4c0 8.3-12.5 16.2-12.5 16.2z"
        fill="#F2545B"
      />
      <path
        d="M9.2 10.2c-1.6.4-2.8 1.8-2.9 3.5"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".75"
        fill="none"
      />
    </>
  ),
  laugh: (
    <>
      {face}
      <path
        d="M8.5 12.5c1.3-1.8 3.7-1.8 5 0M18.5 12.5c1.3-1.8 3.7-1.8 5 0"
        stroke="#5B3A00"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M7.5 17.5h17c0 5-3.8 8.5-8.5 8.5s-8.5-3.5-8.5-8.5z" fill="#5B2A00" />
      <path d="M10.3 23.3a8.3 8.3 0 0 0 11.4 0c-1.4-2-4-3-5.7-3s-4.3 1-5.7 3z" fill="#F2545B" />
      <path d="M9.5 17.5h13v1.6H9.5z" fill="#FFFFFF" />
    </>
  ),
  wow: (
    <>
      {face}
      <path
        d="M8.5 9.3c1.3-1 3.3-1 4.6 0M18.9 9.3c1.3-1 3.3-1 4.6 0"
        stroke="#5B3A00"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="11" cy="14" rx="2" ry="2.6" fill="#3B2A00" />
      <ellipse cx="21" cy="14" rx="2" ry="2.6" fill="#3B2A00" />
      <ellipse cx="16" cy="22.5" rx="3.2" ry="4" fill="#5B2A00" />
    </>
  ),
  sad: (
    <>
      {face}
      <path
        d="M8.5 11.5c1.6-.3 3.2.3 4.3 1.6M23.5 11.5c-1.6-.3-3.2.3-4.3 1.6"
        stroke="#5B3A00"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="11.3" cy="16" r="1.8" fill="#3B2A00" />
      <circle cx="20.7" cy="16" r="1.8" fill="#3B2A00" />
      <path
        d="M11 24.5c2.7-2.6 7.3-2.6 10 0"
        stroke="#5B2A00"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M23.2 17.5c1.5 2.4 2.6 4.2 2.6 5.5a2.6 2.6 0 0 1-5.2 0c0-1.3 1.1-3.1 2.6-5.5z"
        fill="#4FA8F5"
      />
    </>
  ),
  pray: (
    <>
      <path
        d="M15.2 29V13.6c0-3.3-1.6-6.2-3.3-8.3a1.6 1.6 0 0 0-2.8 1.3l1.2 6.6-3.9 7.1c-.9 1.6-.5 3.6.8 4.8L12 29z"
        fill="#FFC83D"
      />
      <path
        d="M16.8 29V13.6c0-3.3 1.6-6.2 3.3-8.3a1.6 1.6 0 0 1 2.8 1.3l-1.2 6.6 3.9 7.1c.9 1.6.5 3.6-.8 4.8L20 29z"
        fill="#FFC83D"
      />
      <path d="M15.2 13.6V29H12l-2.4-4.3 5.6-11.1z" fill="#E6A62E" opacity=".45" />
      <path d="M5 6.5l.9 2.1 2.1.9-2.1.9L5 12.5l-.9-2.1L2 9.5l2.1-.9z" fill="#FFD95A" />
      <path d="M27 5l.7 1.6 1.6.7-1.6.7L27 9.6l-.7-1.6-1.6-.7 1.6-.7z" fill="#FFD95A" />
    </>
  ),
};

const FALLBACK = <circle cx="16" cy="16" r="13" fill="#CBD5E1" />;
