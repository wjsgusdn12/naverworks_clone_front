"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

// 체크 표시 네모만 그리는 부분. 큰 버튼 안에 표시용으로 넣을 때는 이것만 사용.
export function CheckboxControl({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`custom-checkbox-control flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${checked ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white hover:border-blue-400"}`}
    >
      {checked && <Check className="checkbox-check-mark" size={14} strokeWidth={3} />}
    </span>
  );
}

// 프로젝트 공통 체크박스. 화면 어디서든 같은 모양을 쓰도록 여기 하나만 둠.
// text를 주면 오른쪽에 글자 라벨이 함께 보이고, 없으면 label은 스크린 리더용으로만 쓰임.
export function CustomCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
  text,
  className = "",
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  text?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={text ? undefined : label}
      aria-checked={checked}
      disabled={disabled}
      className={`custom-checkbox-button flex cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 ${text ? "gap-2 px-1 py-1 text-sm text-slate-600" : "h-7 w-7"} ${className}`}
      onClick={onChange}
    >
      <CheckboxControl checked={checked} />
      {text}
    </button>
  );
}
