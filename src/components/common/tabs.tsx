"use client";

// 프로젝트 공통 탭(밑줄형). 탭 줄 아래 얇은 회색 선 + 고른 탭은 파란 글씨와 파란 밑줄.
// 새 탭이 필요하면 직접 그리지 말고 이 컴포넌트를 씀.
export type TabItem<T extends string | number> = {
  key: T;
  label: string;
  // 탭 이름 옆 작은 숫자(예: 읽음 3). 없으면 표시 안 함.
  count?: number | string;
};

export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  ariaLabel,
  fill = false,
  className = "",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  // true면 탭들이 줄 너비를 나눠 가짐(좁은 패널용).
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex shrink-0 gap-5 border-b border-slate-200 ${className}`}
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
            className={`-mb-px cursor-pointer whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm transition ${fill ? "flex-1" : ""} ${selected ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={`ml-1 text-xs ${selected ? "text-blue-500" : "font-normal text-slate-400"}`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
