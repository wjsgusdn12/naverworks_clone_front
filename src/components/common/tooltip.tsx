"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

type TooltipProps = {
  // 툴팁에 보여 줄 안내 문구.
  label: ReactNode;
  // 마우스를 올릴 대상(버튼 등).
  children: ReactNode;
  // 기본 위치. 화면 밖으로 나가면 자동으로 반대쪽에 띄움.
  placement?: Placement;
  // 메뉴가 열려 있는 동안처럼 잠시 툴팁을 끄고 싶을 때.
  disabled?: boolean;
  // 긴 안내문은 줄바꿈 허용.
  multiline?: boolean;
  // 감싸는 요소에 줄 추가 클래스(예: w-full).
  className?: string;
};

const GAP = 6;
const MARGIN = 8;

// 프로젝트 공통 툴팁. body에 portal로 그려서 overflow·모달 경계에 잘리지 않고,
// 실제 크기를 잰 뒤 화면 안에 들어오도록 위치와 방향(위/아래)을 보정.
export function Tooltip({
  label,
  children,
  placement = "bottom",
  disabled = false,
  multiline = false,
  className = "",
}: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    // 터치 기기는 hover가 없어 툴팁이 어색하게 남으므로 띄우지 않음.
    if (disabled || window.matchMedia("(hover: none)").matches) return;
    setOpen(true);
  }, [disabled]);
  const hide = useCallback(() => setOpen(false), []);

  // 열려 있는 동안 스크롤·창 크기 변경이 생기면 위치가 어긋나므로 닫음.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  // 메뉴가 열리는 등 disabled로 바뀌면 떠 있던 툴팁도 바로 사라지게 함.
  const visible = open && !disabled;

  // 그린 직후 실제 크기를 재서 DOM 스타일로 바로 배치(상태 갱신 없이 처리해 재렌더링 루프 방지).
  useLayoutEffect(() => {
    if (!visible) return;
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = anchor.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const fitsBelow = rect.bottom + GAP + size.height <= window.innerHeight - MARGIN;
    const fitsAbove = rect.top - GAP - size.height >= MARGIN;
    let resolved = placement;
    if (resolved === "bottom" && !fitsBelow && fitsAbove) resolved = "top";
    if (resolved === "top" && !fitsAbove && fitsBelow) resolved = "bottom";
    const top = resolved === "bottom" ? rect.bottom + GAP : rect.top - GAP - size.height;
    // 가운데 정렬을 기본으로 하되, 좌우 화면 밖으로 나가면 안쪽으로 밀어 넣음.
    const centered = rect.left + rect.width / 2 - size.width / 2;
    const left = Math.max(MARGIN, Math.min(centered, window.innerWidth - MARGIN - size.width));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = "visible";
  }, [visible, placement]);

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
            className={`pointer-events-none z-[130] rounded bg-zinc-700 text-white shadow-md ${multiline ? "max-w-60 whitespace-normal px-3 py-2 text-[13px] leading-5" : "whitespace-nowrap px-2.5 py-1.5 text-xs font-medium"}`}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
