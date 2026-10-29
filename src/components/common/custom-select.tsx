"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

// 프로젝트 공통 드롭다운. 브라우저 기본 select 대신 입력칸과 같은 모양의 버튼 + 목록으로 그림.
// 값이 ""인 항목은 "선택 안 함"처럼 비우는 용도로 씀.
export type SelectOption = { value: string; label: string };

type CustomSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  // 접근성 라벨. 보이는 라벨이 따로 있으면 그 글자를 넘김.
  label: string;
  className?: string;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "선택",
  disabled = false,
  label,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  // 키보드로 훑는 항목 위치.
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  // 바깥 클릭·Esc로 닫기.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setHighlight(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (options[highlight]) choose(options[highlight]);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        className={`flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-left text-sm outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 ${open ? "border-blue-600 ring-4 ring-blue-100" : "border-slate-300 hover:border-blue-400 focus:border-blue-600 focus:ring-blue-100"}`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value || "__empty"}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(option)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 ${index === highlight ? "bg-blue-50 text-blue-700" : "text-slate-700"} ${option.value === "" ? "text-slate-500" : ""}`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={14} aria-hidden="true" className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
