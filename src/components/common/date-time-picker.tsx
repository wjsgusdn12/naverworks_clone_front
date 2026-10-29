"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CustomSelect } from "@/components/common/custom-select";

// 프로젝트 공통 날짜·시각 선택기. 브라우저 기본 datetime-local 대신 달력 + 시·분 드롭다운으로 그림.
// min~max 밖의 날짜는 누를 수 없고, 고른 값이 범위를 벗어나면 가장 가까운 끝으로 맞춤.
type DateTimePickerProps = {
  value: Date;
  onChange: (value: Date) => void;
  min: Date;
  max: Date;
  // 분 단위 간격. 기본 10분.
  minuteStep?: number;
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (value: number) => String(value).padStart(2, "0");
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  minuteStep = 10,
}: DateTimePickerProps) {
  // 달력에 보이는 달. 처음엔 고른 값이 있는 달.
  const [viewMonth, setViewMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const today = new Date();

  // 범위를 벗어나면 끝값으로 맞춰 알림.
  const emit = (next: Date) => {
    const time = Math.min(Math.max(next.getTime(), min.getTime()), max.getTime());
    onChange(new Date(time));
  };

  const pickDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    emit(next);
  };
  const pickTime = (hours: number, minutes: number) => {
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    emit(next);
  };

  // 달력 칸: 첫 주 앞쪽 빈칸 + 그 달의 날짜.
  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index + 1),
    ),
  ];
  const minDay = startOfDay(min).getTime();
  const maxDay = startOfDay(max).getTime();
  const canPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getTime() >= minDay;
  const canNext =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getTime() <= maxDay;
  const moveMonth = (offset: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1));

  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${hour < 12 ? "오전" : "오후"} ${pad(hour % 12 === 0 ? 12 : hour % 12)}시`,
  }));
  const minuteOptions = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => ({
    value: String(index * minuteStep),
    label: `${pad(index * minuteStep)}분`,
  }));
  // 분 간격에 맞지 않는 현재 값(예: 최소 시각으로 맞춘 경우)은 가까운 아래 칸으로 표시.
  const minuteValue = String(Math.floor(value.getMinutes() / minuteStep) * minuteStep);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          disabled={!canPrev}
          onClick={() => moveMonth(-1)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <strong className="text-sm text-slate-900">
          {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
        </strong>
        <button
          type="button"
          aria-label="다음 달"
          disabled={!canNext}
          onClick={() => moveMonth(1)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
        {weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={`py-1 font-medium ${index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-slate-400"}`}
          >
            {weekday}
          </span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const disabled = day.getTime() < minDay || day.getTime() > maxDay;
          const selected = sameDay(day, value);
          const isToday = sameDay(day, today);
          return (
            <button
              key={day.getTime()}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일`}
              onClick={() => pickDay(day)}
              className={`mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-default disabled:text-slate-300 ${selected ? "bg-blue-600 font-semibold text-white" : isToday ? "font-semibold text-blue-600 ring-1 ring-blue-200 hover:bg-blue-50" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <CustomSelect
          label="시"
          value={String(value.getHours())}
          onChange={(hour) => pickTime(Number(hour), value.getMinutes())}
          options={hourOptions}
          className="flex-1 [&>button]:h-9 [&>button]:px-3"
        />
        <CustomSelect
          label="분"
          value={minuteValue}
          onChange={(minute) => pickTime(value.getHours(), Number(minute))}
          options={minuteOptions}
          className="w-24 [&>button]:h-9 [&>button]:px-3"
        />
      </div>
    </div>
  );
}
