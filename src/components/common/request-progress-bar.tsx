"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getPendingRequestCount, subscribePendingRequests } from "@/lib/api/request-tracker";

// 서버 요청이 진행 중이면 화면 맨 위에 얇은 파란 막대가 흐름. 모든 화면에 고정으로 붙어 있음.
// 아주 짧은 요청(읽음 처리 등)마다 깜빡이지 않도록 150ms 넘게 걸릴 때만 보여 줌.
const SHOW_DELAY_MS = 150;

export function RequestProgressBar() {
  const pending = useSyncExternalStore(subscribePendingRequests, getPendingRequestCount, () => 0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 요청이 생기면 잠깐 기다렸다 보이고, 모두 끝나면 바로 숨김. 상태 변경은 타이머 안에서만 함.
    const timer = window.setTimeout(() => setVisible(pending > 0), pending > 0 ? SHOW_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[300] h-0.5 overflow-hidden transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <span className="sr-only">{visible ? "서버에서 불러오는 중입니다." : ""}</span>
      <span className="request-progress-bar block h-full w-1/3 rounded-full bg-blue-500" />
    </div>
  );
}
