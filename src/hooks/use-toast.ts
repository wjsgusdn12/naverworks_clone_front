"use client";

import { useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 3_000;

export type ToastState = {
  id: number;
  message: string;
  phase: "enter" | "replay" | "exit";
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSequenceRef = useRef(0);

  useEffect(() => {
    return () => {
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current);
      }

      if (toastRemoveTimerRef.current) {
        clearTimeout(toastRemoveTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
    }

    if (toastRemoveTimerRef.current) {
      clearTimeout(toastRemoveTimerRef.current);
    }

    // 재클릭하면 표시 시간을 새로 시작.
    toastSequenceRef.current += 1;
    const toastId = toastSequenceRef.current;

    setToast((currentToast) => ({
      id: toastId,
      message,
      phase: currentToast ? "replay" : "enter",
    }));

    toastHideTimerRef.current = setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === toastId ? { ...currentToast, phase: "exit" } : currentToast,
      );
    }, TOAST_DURATION_MS - 300);

    toastRemoveTimerRef.current = setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toastId ? null : currentToast));
    }, TOAST_DURATION_MS);
  };

  return { toast, showToast };
}
