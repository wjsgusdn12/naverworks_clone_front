import { X } from "lucide-react";

// 토스트 컴포넌트에 전달하는 표시 문구와 애니메이션 단계.
type ToastProps = {
  message: string;
  phase: "enter" | "replay" | "exit";
  onClose: () => void;
};

export function Toast({ message, phase, onClose }: ToastProps) {
  return (
    <div
      // 보조기기도 새 알림을 읽을 수 있게 상태 영역으로 선언.
      role="status"
      aria-live="polite"
      className={`toast-${phase} fixed bottom-6 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md items-center justify-center rounded-xl bg-slate-900 px-12 py-3.5 text-center text-sm font-medium text-white shadow-xl`}
    >
      {message}
      <button
        type="button"
        aria-label="토스트 닫기"
        onClick={onClose}
        className="absolute right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-300 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
