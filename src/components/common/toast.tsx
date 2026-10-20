// 토스트 컴포넌트에 전달하는 표시 문구와 애니메이션 단계.
type ToastProps = {
  message: string;
  phase: "enter" | "replay" | "exit";
};

export function Toast({ message, phase }: ToastProps) {
  return (
    <div
      // 보조기기도 새 알림을 읽을 수 있게 상태 영역으로 선언.
      role="status"
      aria-live="polite"
      className={`toast-${phase} fixed bottom-6 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md rounded-xl bg-slate-900 px-5 py-3.5 text-center text-sm font-medium text-white shadow-xl`}
    >
      {message}
    </div>
  );
}
