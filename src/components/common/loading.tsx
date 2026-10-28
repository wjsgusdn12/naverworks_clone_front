"use client";

import { LoaderCircle } from "lucide-react";

// 프로젝트 공통 로딩 표시. 세 가지 형태를 상황에 맞게 골라 씀.
// - Spinner: 회전 아이콘만. 버튼 안처럼 글자 옆에 붙일 때.
// - LoadingInline: 아이콘 + 짧은 문구 한 줄. 목록 끝·상단 알림띠·버튼 안.
// - LoadingState: 영역 가운데에 아이콘과 문구를 세로로. 화면·패널이 통째로 비어 있을 때.

type SpinnerProps = {
  // 픽셀 단위 크기.
  size?: number;
  // 색은 부모 글자색을 따르므로 text-* 클래스로 바꿈.
  className?: string;
};

export function Spinner({ size = 16, className = "" }: SpinnerProps) {
  return (
    <LoaderCircle size={size} aria-hidden="true" className={`shrink-0 animate-spin ${className}`} />
  );
}

type LoadingInlineProps = {
  message: string;
  size?: number;
  className?: string;
  // 아이콘만 다른 색으로 칠하고 싶을 때(기본 파란색).
  spinnerClassName?: string;
};

export function LoadingInline({
  message,
  size = 14,
  className = "",
  spinnerClassName = "text-blue-500",
}: LoadingInlineProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Spinner size={size} className={spinnerClassName} />
      <span>{message}</span>
    </span>
  );
}

type LoadingStateProps = {
  message: string;
  // sm: 모달·작은 목록, md: 화면 한 영역 전체.
  size?: "sm" | "md";
  className?: string;
};

export function LoadingState({ message, size = "sm", className = "" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 ${className}`}
    >
      <Spinner size={size === "md" ? 24 : 20} className="text-blue-500" />
      <p>{message}</p>
    </div>
  );
}
