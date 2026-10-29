"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// 공통 페이지네이션. 페이지 번호는 0부터 시작하고 화면에는 1부터 보여 줌.
type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  // 스크린 리더용 영역 이름. 목록이 여러 개인 화면에서 구분할 때 지정.
  label?: string;
  className?: string;
};

// 현재 페이지 주변으로 최대 5개의 번호만 보여 줌.
const visiblePages = (page: number, totalPages: number) => {
  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  const end = Math.min(totalPages, start + 5);
  return Array.from({ length: end - start }, (_, index) => start + index);
};

const arrowClassName =
  "flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:opacity-30";

export function Pagination({
  page,
  totalPages,
  onChange,
  label = "페이지",
  className = "",
}: PaginationProps) {
  return (
    <nav
      aria-label={label}
      className={`flex items-center justify-center gap-1.5 text-sm ${className}`}
    >
      <button
        disabled={page === 0}
        aria-label="이전 페이지"
        className={arrowClassName}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {visiblePages(page, totalPages).map((target) => (
        <button
          key={target}
          aria-current={target === page ? "page" : undefined}
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full font-medium transition ${target === page ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
          onClick={() => onChange(target)}
        >
          {target + 1}
        </button>
      ))}
      <button
        disabled={page >= totalPages - 1}
        aria-label="다음 페이지"
        className={arrowClassName}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
