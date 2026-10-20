type ToastProps = {
  message: string;
  phase: "enter" | "replay" | "exit";
};

export function Toast({ message, phase }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-${phase} fixed bottom-6 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md rounded-xl bg-slate-900 px-5 py-3.5 text-center text-sm font-medium text-white shadow-xl`}
    >
      {message}
    </div>
  );
}
