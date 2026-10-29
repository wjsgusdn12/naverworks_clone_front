"use client";

import { Check } from "lucide-react";

export function CustomCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={label}
      aria-checked={checked}
      className="custom-checkbox-button flex h-7 w-7 cursor-pointer items-center justify-center rounded-md"
      onClick={onChange}
    >
      <span
        className={`custom-checkbox-control flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white hover:border-blue-400"}`}
      >
        {checked && <Check className="checkbox-check-mark" size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}
