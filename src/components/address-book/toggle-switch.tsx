"use client";

export function ToggleSwitch({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-checked={enabled}
      role="switch"
      className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
      onClick={onToggle}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${enabled ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}
