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
      viewBox="0 0 64 64"
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

// 그라데이션 정의. 같은 id가 페이지에 여러 번 있어도 내용이 같아 문제없음.
const defs = (
  <defs>
    <radialGradient id="re-face" cx="36%" cy="30%" r="75%">
      <stop offset="0" stopColor="#FFEE7A" />
      <stop offset="0.55" stopColor="#FFCF35" />
      <stop offset="1" stopColor="#F0961E" />
    </radialGradient>
    <radialGradient id="re-mouth" cx="50%" cy="25%" r="80%">
      <stop offset="0" stopColor="#5A2D05" />
      <stop offset="1" stopColor="#2A1200" />
    </radialGradient>
    <linearGradient id="re-tongue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FF7A8E" />
      <stop offset="1" stopColor="#E63B5A" />
    </linearGradient>
    <linearGradient id="re-heart" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stopColor="#FF8A9B" />
      <stop offset="0.5" stopColor="#F23D5E" />
      <stop offset="1" stopColor="#C8103A" />
    </linearGradient>
    <linearGradient id="re-tear" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#9BE3FF" />
      <stop offset="1" stopColor="#1E9BE8" />
    </linearGradient>
    <linearGradient id="re-sleeve" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#5B9BFF" />
      <stop offset="1" stopColor="#2563EB" />
    </linearGradient>
    <radialGradient id="re-eye" cx="35%" cy="30%" r="80%">
      <stop offset="0" stopColor="#5A3410" />
      <stop offset="1" stopColor="#1F0E00" />
    </radialGradient>
  </defs>
);

// 얼굴형 이모지 공통 바탕: 노란 원 + 가장자리 어두운 테두리 + 왼쪽 위 하이라이트 + 아래쪽 그림자.
const face = (
  <>
    {defs}
    <circle cx="32" cy="32" r="30" fill="#D97C12" />
    <circle cx="32" cy="31.5" r="29" fill="url(#re-face)" />
    <path d="M6.5 38a26 26 0 0 0 51 0A28.5 28.5 0 0 1 6.5 38z" fill="#D97C12" opacity=".3" />
    <ellipse
      cx="20"
      cy="15"
      rx="9.5"
      ry="4.6"
      fill="#FFFFFF"
      opacity=".5"
      transform="rotate(-30 20 15)"
    />
    <ellipse
      cx="46"
      cy="50"
      rx="7"
      ry="3"
      fill="#FFFFFF"
      opacity=".12"
      transform="rotate(-30 46 50)"
    />
  </>
);

// 볼 홍조.
const blush = (
  <>
    <ellipse cx="13" cy="38" rx="5" ry="3" fill="#FF7A5C" opacity=".35" />
    <ellipse cx="51" cy="38" rx="5" ry="3" fill="#FF7A5C" opacity=".35" />
  </>
);

// 눈: 둥근 눈동자 + 두 개의 광택.
const eye = (cx: number, cy: number, rx: number, ry: number) => (
  <>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#re-eye)" />
    <circle cx={cx + rx * 0.35} cy={cy - ry * 0.4} r={rx * 0.36} fill="#FFFFFF" />
    <circle cx={cx - rx * 0.3} cy={cy + ry * 0.35} r={rx * 0.16} fill="#FFFFFF" opacity=".7" />
  </>
);

// 눈물: 물방울 + 광택.
const tear = (x: number, scale = 1) => (
  <g transform={`translate(${x} 0) scale(${scale})`}>
    <path
      d="M0 29c-4.5 7-6.5 11-6.5 14.5a6.5 6.5 0 0 0 13 0C6.5 40 4.5 36 0 29z"
      fill="url(#re-tear)"
    />
    <path
      d="M0 29c-4.5 7-6.5 11-6.5 14.5a6.5 6.5 0 0 0 4 6C-4 46-3.5 40 0 33z"
      fill="#FFFFFF"
      opacity=".25"
    />
    <ellipse cx="-2.3" cy="41.5" rx="1.5" ry="2.8" fill="#FFFFFF" opacity=".8" />
  </g>
);

const ART: Record<string, ReactNode> = {
  thumbs_up: (
    <>
      {defs}
      {/* 소매 */}
      <rect x="4" y="29" width="12" height="27" rx="3.5" fill="url(#re-sleeve)" />
      <rect x="4" y="29" width="12" height="6" rx="3" fill="#8AB8FF" opacity=".8" />
      <rect x="6" y="36" width="2.5" height="16" rx="1.2" fill="#1D4ED8" opacity=".35" />
      {/* 손 외곽(어두운 테두리) */}
      <path
        d="M18 56.5h25.2a7.3 7.3 0 0 0 7.1-5.5l4.3-17.4a5.9 5.9 0 0 0-5.7-7.3H36.6l2.3-10.3a6 6 0 0 0-11.2-3.8L18 27.6z"
        fill="#D97C12"
      />
      {/* 손 */}
      <path
        d="M19 55h23.8a6.3 6.3 0 0 0 6.1-4.8l4.2-17a5 5 0 0 0-4.8-6.2H35.6l2.3-10.4a5.1 5.1 0 0 0-9.5-3.2L19 28.5z"
        fill="url(#re-face)"
      />
      {/* 손가락 분리 홈 */}
      <path
        d="M42 33.5h7.5M41.5 40.5h7.5M41 47.5h7"
        stroke="#D97C12"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".55"
      />
      <path
        d="M42 35h7.5M41.5 42h7.5M41 49h7"
        stroke="#FFE98A"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".55"
      />
      {/* 엄지 안쪽 그림자 */}
      <path
        d="M19 28.5l9-15.7a5.1 5.1 0 0 1 3.2-2.4c-1.6 4.2-3.3 9-4.3 13.4L19 34z"
        fill="#D97C12"
        opacity=".28"
      />
      {/* 하이라이트 */}
      <ellipse
        cx="31"
        cy="19"
        rx="4.5"
        ry="1.8"
        fill="#FFFFFF"
        opacity=".5"
        transform="rotate(-62 31 19)"
      />
      <ellipse
        cx="28"
        cy="46"
        rx="6"
        ry="2.2"
        fill="#FFFFFF"
        opacity=".18"
        transform="rotate(-10 28 46)"
      />
    </>
  ),
  heart: (
    <>
      {defs}
      <path
        d="M32 58.5S4.5 42 4.5 22.5C4.5 13.5 11.5 6.5 20 6.5c5.4 0 10 2.8 12 7 2-4.2 6.6-7 12-7 8.5 0 15.5 7 15.5 16C59.5 42 32 58.5 32 58.5z"
        fill="#B5103A"
      />
      <path
        d="M32 57S6 41.5 6 22.5C6 14.3 12.3 8 20 8c5.2 0 9.7 2.7 12 6.8 2.3-4.1 6.8-6.8 12-6.8 7.7 0 14 6.3 14 14.5C58 41.5 32 57 32 57z"
        fill="url(#re-heart)"
      />
      {/* 아래쪽 깊이 */}
      <path
        d="M32 57S6 41.5 6 22.5c0-.8 0-1.6.1-2.4C9 37 32 50.5 32 50.5S55 37 57.9 20.1c.1.8.1 1.6.1 2.4C58 41.5 32 57 32 57z"
        fill="#9E0C30"
        opacity=".45"
      />
      {/* 광택 */}
      <ellipse
        cx="17.5"
        cy="18"
        rx="6"
        ry="3.2"
        fill="#FFFFFF"
        opacity=".7"
        transform="rotate(-40 17.5 18)"
      />
      <ellipse
        cx="44"
        cy="15.5"
        rx="2.2"
        ry="1.3"
        fill="#FFFFFF"
        opacity=".5"
        transform="rotate(-30 44 15.5)"
      />
    </>
  ),
  laugh: (
    <>
      {face}
      {blush}
      {/* 웃어서 감긴 눈 */}
      <path
        d="M13 27c3.5-7 12-7 15.5 0M35.5 27c3.5-7 12-7 15.5 0"
        stroke="#2A1200"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* 입 외곽과 속 */}
      <path d="M13 34.5h38c0 12.5-8.5 22-19 22S13 47 13 34.5z" fill="#2A1200" />
      <path d="M14.5 35.5h35c0 11-8 19.5-17.5 19.5S14.5 46.5 14.5 35.5z" fill="url(#re-mouth)" />
      {/* 윗니 */}
      <path d="M17 35.5h30v4.8H17z" fill="#FFFFFF" />
      <path d="M17 39.5h30v1.2H17z" fill="#D9D9D9" opacity=".7" />
      {/* 혀 */}
      <path
        d="M19.5 49.5c3.2-5 8-7.5 12.5-7.5s9.3 2.5 12.5 7.5c-3.2 3.6-7.8 5.5-12.5 5.5s-9.3-1.9-12.5-5.5z"
        fill="url(#re-tongue)"
      />
      <path d="M32 42.5v11" stroke="#C72A47" strokeWidth="1.4" opacity=".5" />
      <ellipse
        cx="26"
        cy="46"
        rx="3"
        ry="1.3"
        fill="#FFFFFF"
        opacity=".35"
        transform="rotate(-20 26 46)"
      />
      {tear(9)}
      {tear(55)}
    </>
  ),
  wow: (
    <>
      {face}
      {/* 올라간 눈썹 */}
      <path
        d="M14 14.5c4.2-3.6 9.5-4 14.2-1.8M50 14.5c-4.2-3.6-9.5-4-14.2-1.8"
        stroke="#2A1200"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 흰자 + 눈동자 */}
      <ellipse cx="21.5" cy="28" rx="7.2" ry="9" fill="#FFFFFF" />
      <ellipse cx="42.5" cy="28" rx="7.2" ry="9" fill="#FFFFFF" />
      {eye(21.5, 29, 4.8, 6.2)}
      {eye(42.5, 29, 4.8, 6.2)}
      {/* 벌린 입 */}
      <ellipse cx="32" cy="47" rx="8" ry="10" fill="#2A1200" />
      <ellipse cx="32" cy="47.5" rx="6.6" ry="8.6" fill="url(#re-mouth)" />
      <ellipse cx="32" cy="52.5" rx="4.6" ry="3.4" fill="url(#re-tongue)" />
      <ellipse cx="29.5" cy="41.5" rx="2" ry="1" fill="#FFFFFF" opacity=".2" />
    </>
  ),
  sad: (
    <>
      {face}
      {/* 처진 눈썹 */}
      <path
        d="M13.5 21.5c4.2-3.8 9-5 13.2-3M50.5 21.5c-4.2-3.8-9-5-13.2-3"
        stroke="#2A1200"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      {eye(21.5, 31, 4.6, 4.8)}
      {eye(42.5, 31, 4.6, 4.8)}
      {/* 울상 입 */}
      <path
        d="M21.5 49.5c5.5-7 15.5-7 21 0"
        stroke="#2A1200"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* 눈물 한 방울 */}
      {tear(47, 1.05)}
    </>
  ),
  pray: (
    <>
      {defs}
      {/* 소매 */}
      <path d="M12 46h18.5v12H15a3 3 0 0 1-3-3z" fill="url(#re-sleeve)" />
      <path d="M33.5 46H52v9a3 3 0 0 1-3 3H33.5z" fill="url(#re-sleeve)" />
      <path d="M12 46h18.5v3.2H12zM33.5 46H52v3.2H33.5z" fill="#8AB8FF" opacity=".8" />
      {/* 손 외곽(어두운 테두리) */}
      <path
        d="M31.5 53.5V13.5c0-6.5-7.8-8.5-10.8-3L16.8 24c-4 8-4 16.5-.5 24l4.5 5.5z"
        fill="#D97C12"
      />
      <path
        d="M32.5 53.5V13.5c0-6.5 7.8-8.5 10.8-3L47.2 24c4 8 4 16.5.5 24l-4.5 5.5z"
        fill="#D97C12"
      />
      {/* 왼손: 가운데 선에서 맞닿고, 손가락 끝은 위로 모이며 손바닥은 바깥으로 둥글게 */}
      <path
        d="M31.5 52V14c0-5.5-6.5-7-9-2.5L18 25c-3.5 7-3.5 14.5-.5 21l4 6z"
        fill="url(#re-face)"
      />
      {/* 오른손 */}
      <path
        d="M32.5 52V14c0-5.5 6.5-7 9-2.5L46 25c3.5 7 3.5 14.5.5 21l-4 6z"
        fill="url(#re-face)"
      />
      {/* 손가락 사이 결 */}
      <path
        d="M27.6 12.5L23.2 26M36.4 12.5L40.8 26"
        stroke="#D97C12"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".5"
      />
      {/* 맞닿은 가운데 선 */}
      <path d="M31.4 15v37h1.2V15z" fill="#B8690E" opacity=".6" />
      {/* 앞으로 교차한 엄지 */}
      <ellipse cx="25" cy="38" rx="4.6" ry="9.4" fill="#D97C12" transform="rotate(22 25 38)" />
      <ellipse cx="39" cy="38" rx="4.6" ry="9.4" fill="#D97C12" transform="rotate(-22 39 38)" />
      <ellipse cx="25" cy="38" rx="3.8" ry="8.6" fill="#FFD23F" transform="rotate(22 25 38)" />
      <ellipse cx="39" cy="38" rx="3.8" ry="8.6" fill="#FFD23F" transform="rotate(-22 39 38)" />
      <ellipse
        cx="24"
        cy="33"
        rx="1.3"
        ry="3"
        fill="#FFFFFF"
        opacity=".45"
        transform="rotate(22 24 33)"
      />
      <ellipse
        cx="40"
        cy="33"
        rx="1.3"
        ry="3"
        fill="#FFFFFF"
        opacity=".45"
        transform="rotate(-22 40 33)"
      />
      {/* 손 하이라이트 */}
      <ellipse
        cx="23.5"
        cy="18"
        rx="1.6"
        ry="4"
        fill="#FFFFFF"
        opacity=".45"
        transform="rotate(18 23.5 18)"
      />
      <ellipse
        cx="40.5"
        cy="18"
        rx="1.6"
        ry="4"
        fill="#FFFFFF"
        opacity=".45"
        transform="rotate(-18 40.5 18)"
      />
      {/* 반짝임 */}
      <path d="M8 5l1.7 4.4L14.2 11l-4.5 1.7L8 17.2l-1.7-4.5L1.8 11l4.5-1.6z" fill="#FFD54F" />
      <path d="M8 5l1.7 4.4L14.2 11H8z" fill="#FFFFFF" opacity=".5" />
      <path d="M56 3l1.3 3.3 3.4 1.3-3.4 1.3L56 12.2l-1.3-3.3-3.4-1.3 3.4-1.3z" fill="#FFD54F" />
      <path d="M56 3l1.3 3.3 3.4 1.3H56z" fill="#FFFFFF" opacity=".5" />
    </>
  ),
};

const FALLBACK = <circle cx="32" cy="32" r="26" fill="#CBD5E1" />;
