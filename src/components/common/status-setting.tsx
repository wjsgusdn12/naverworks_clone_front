"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  formatStatusUntil,
  memberStatusOptions,
  type MemberStatusType,
} from "@/lib/status-options";

// 상태 설정 목록(설정 안 함 · 바쁨 · 자리 비움 · 퇴근 · 부재 · 휴가 · 출장 · 병가).
// 상태를 고르면 아래에 자동 해제 시점이 열리고, "적용"을 눌러야 저장됨. "설정 안 함"은 바로 저장.
type StatusSettingProps = {
  statusType: MemberStatusType | null;
  statusUntil: string | null;
  saving: boolean;
  onSave: (statusType: MemberStatusType | null, statusUntil: Date | null) => void;
};

type UntilChoice = "NONE" | "1H" | "4H" | "TODAY" | "WEEK" | "CUSTOM";

// 서버 상한(90일)과 맞춤.
const MAX_DAYS = 90;

// 자동 해제 시점 → 실제 시각. 계속·직접 설정은 null(직접 설정은 따로 고른 값 사용).
const untilFor = (choice: UntilChoice): Date | null => {
  const now = new Date();
  switch (choice) {
    case "1H":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "4H":
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case "TODAY":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
    case "WEEK": {
      // 이번 주 일요일 23:59. 오늘이 일요일이면 오늘.
      const daysToSunday = (7 - now.getDay()) % 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday, 23, 59);
    }
    default:
      return null;
  }
};

const untilChoices: { value: UntilChoice; label: string }[] = [
  { value: "NONE", label: "계속" },
  { value: "1H", label: "1시간" },
  { value: "4H", label: "4시간" },
  { value: "TODAY", label: "오늘까지" },
  { value: "WEEK", label: "이번 주까지" },
  { value: "CUSTOM", label: "직접 설정" },
];

// 직접 설정 기본값: 내일 09:00.
const tomorrowNine = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
};

export function StatusSetting({ statusType, statusUntil, saving, onSave }: StatusSettingProps) {
  // 고르는 중인 상태. 처음엔 현재 상태.
  const [draft, setDraft] = useState<MemberStatusType | null>(statusType);
  const [untilChoice, setUntilChoice] = useState<UntilChoice>(statusUntil ? "CUSTOM" : "NONE");
  const [customUntil, setCustomUntil] = useState<Date>(() =>
    statusUntil ? new Date(statusUntil) : tomorrowNine(),
  );

  const choose = (type: MemberStatusType | null) => {
    setDraft(type);
    // 설정 안 함은 고를 것이 더 없어 바로 저장.
    if (type === null && statusType !== null) onSave(null, null);
  };

  const apply = () => {
    if (!draft) return;
    onSave(draft, untilChoice === "CUSTOM" ? customUntil : untilFor(untilChoice));
  };

  const now = new Date();
  const maxUntil = new Date(now.getTime() + MAX_DAYS * 24 * 60 * 60 * 1000);
  const radioClassName = (selected: boolean) =>
    `flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${selected ? "border-blue-600" : "border-slate-300"}`;

  return (
    <div className="space-y-3">
      <ul role="radiogroup" aria-label="상태 설정" className="space-y-0.5">
        <li>
          <button
            type="button"
            role="radio"
            aria-checked={draft === null}
            disabled={saving}
            onClick={() => choose(null)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50"
          >
            <span className={radioClassName(draft === null)}>
              {draft === null && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </span>
            <span className={draft === null ? "font-semibold text-blue-600" : "text-slate-700"}>
              설정 안 함
            </span>
          </button>
        </li>
        {memberStatusOptions.map(({ type, label, icon: Icon, className }) => {
          const selected = draft === type;
          return (
            <li key={type}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => choose(type)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50"
              >
                <span className={radioClassName(selected)}>
                  {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${className}`}
                >
                  <Icon size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className={selected ? "font-semibold text-blue-600" : "text-slate-700"}>
                  {label}
                </span>
                {statusType === type && (
                  <span className="ml-auto text-xs text-slate-400">
                    {statusUntil ? formatStatusUntil(statusUntil) : "현재 상태"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {draft !== null && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">자동 해제</p>
          <div className="flex flex-wrap gap-1.5">
            {untilChoices.map(({ value, label }) => {
              const selected = untilChoice === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setUntilChoice(value)}
                  className={`flex h-8 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs transition ${selected ? "border-blue-600 bg-blue-600 font-semibold text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}
                >
                  {selected && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {label}
                </button>
              );
            })}
          </div>
          {untilChoice === "CUSTOM" && (
            <DateTimePicker
              value={customUntil}
              onChange={setCustomUntil}
              min={new Date(now.getTime() + 60 * 1000)}
              max={maxUntil}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-slate-500">
              {untilChoice === "NONE"
                ? "직접 바꿀 때까지 유지"
                : formatStatusUntil(
                    (untilChoice === "CUSTOM" ? customUntil : untilFor(untilChoice))!.toISOString(),
                  )}
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setDraft(statusType)}
                disabled={saving}
                className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={saving}
                className="h-8 cursor-pointer rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                적용
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
