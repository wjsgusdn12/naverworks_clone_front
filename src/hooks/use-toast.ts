"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 토스트가 화면에 머무르는 시간.
const TOAST_DURATION_MS = 5_000;
const TOAST_EXIT_DURATION_MS = 300;

// 화면에 표시할 토스트 데이터와 현재 애니메이션 단계.
export type ToastState = {
  id: number;
  message: string;
  phase: "enter" | "replay" | "exit";
};

export function useToast() {
  // 토스트가 없으면 null, 표시 중이면 메시지와 애니메이션 정보를 보관.
  const [toast, setToast] = useState<ToastState | null>(null);
  // 이전 타이머를 취소하기 위해 타이머 ID를 ref에 저장.
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSequenceRef = useRef(0);

  const clearToastTimers = useCallback(() => {
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
      toastHideTimerRef.current = null;
    }

    if (toastRemoveTimerRef.current) {
      clearTimeout(toastRemoveTimerRef.current);
      toastRemoveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // 화면을 떠날 때 남아 있는 타이머를 정리.
    return () => {
      clearToastTimers();
    };
  }, [clearToastTimers]);

  const showToast = useCallback((message: string) => {
    // 연속 클릭 시 이전 종료 예약을 취소하고 새 토스트 시간을 시작.
    clearToastTimers();

    // 재클릭하면 key를 바꿔 애니메이션을 다시 재생.
    toastSequenceRef.current += 1;
    const toastId = toastSequenceRef.current;

    setToast((currentToast) => ({
      id: toastId,
      message,
      phase: currentToast ? "replay" : "enter",
    }));

    // 종료 애니메이션이 보일 수 있도록 제거보다 먼저 단계만 변경.
    toastHideTimerRef.current = setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === toastId ? { ...currentToast, phase: "exit" } : currentToast,
      );
    }, TOAST_DURATION_MS - TOAST_EXIT_DURATION_MS);

    toastRemoveTimerRef.current = setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toastId ? null : currentToast));
    }, TOAST_DURATION_MS);
  }, [clearToastTimers]);

  const dismissToast = useCallback(() => {
    // 수동 닫기 후 이전 자동 종료 타이머가 다시 실행되지 않게 제거.
    clearToastTimers();

    if (!toast) {
      return;
    }

    const toastId = toast.id;

    // 자동 종료와 같은 퇴장 애니메이션을 재사용.
    setToast({ ...toast, phase: "exit" });
    toastRemoveTimerRef.current = setTimeout(() => {
      setToast((activeToast) => (activeToast?.id === toastId ? null : activeToast));
    }, TOAST_EXIT_DURATION_MS);
  }, [clearToastTimers, toast]);

  const resetToast = useCallback(() => {
    // 로그아웃·화면 이탈 때 이전 화면의 안내가 새 화면에 남지 않게 제거.
    clearToastTimers();
    setToast(null);
  }, [clearToastTimers]);

  return { toast, showToast, dismissToast, resetToast };
}
