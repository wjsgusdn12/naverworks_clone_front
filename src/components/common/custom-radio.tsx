"use client";

import { Check } from "lucide-react";

// 프로젝트 공통 라디오 표시. 공통 체크박스(CheckboxControl)와 같은 색·테두리·선택 링을 쓰고 모양만 원형.
// 큰 버튼(role="radio") 안에 표시용으로 넣어 씀.
export function RadioControl({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${checked ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white group-hover:border-blue-400"}`}
    >
      {checked && <Check className="checkbox-check-mark" size={12} strokeWidth={3.5} />}
    </span>
  );
}
