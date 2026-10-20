"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { LoginForm } from "@/components/login/login-form";
import { useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 3_000;

type ToastState = {
  id: number;
  message: string;
  phase: "enter" | "replay" | "exit";
};

export default function Home() {
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <GlobalHeader onProtectedAction={() => showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.")} />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <LoginForm onToast={showToast} />
      </main>
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} />}
    </div>
  );
}
