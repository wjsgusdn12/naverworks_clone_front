"use client";

import {
  columnName,
  MAX_PREVIEW_COLUMNS,
  MAX_PREVIEW_ROWS,
  type GridSheet,
} from "@/lib/sheet-preview";
import { useState } from "react";

// 엑셀처럼 보이는 격자: 위쪽 열 이름(A·B·C), 왼쪽 행 번호, 아래쪽 시트 탭.
// 머리글은 스크롤해도 고정되고, 셀 서식(굵게·색·정렬)과 병합을 반영함.
export function SheetPreview({ sheets }: { sheets: GridSheet[] }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active];
  if (!sheet) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-slate-500">
        [미리보기 불가] 표시할 시트 없음
      </p>
    );
  }
  const headerCell = "border border-slate-300 bg-slate-100 text-[11px] font-medium text-slate-500";
  return (
    <div className="flex h-full flex-col bg-white">
      {sheet.truncated && (
        <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
          [일부만 표시] 시트당 최대 {MAX_PREVIEW_ROWS.toLocaleString()}행 · {MAX_PREVIEW_COLUMNS}열
          · 전체는 내려받아 확인
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="border-collapse text-[13px] text-slate-800"
          style={{ tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: 44 }} />
            {sheet.columnWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={`${headerCell} sticky left-0 top-0 z-20 h-6`} />
              {Array.from({ length: sheet.columnCount }, (_, index) => (
                <th key={index} className={`${headerCell} sticky top-0 z-10 h-6`}>
                  {columnName(index + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ height: sheet.rowHeights[rowIndex] ?? 24 }}>
                <th className={`${headerCell} sticky left-0 z-10 px-1`}>{rowIndex + 1}</th>
                {row.map((cell, columnIndex) =>
                  cell.covered ? null : (
                    <td
                      key={columnIndex}
                      rowSpan={cell.rowSpan}
                      colSpan={cell.colSpan}
                      title={cell.text}
                      style={cell.style}
                      className="overflow-hidden border border-slate-200 px-1.5 align-middle whitespace-nowrap"
                    >
                      {cell.text}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 시트가 여러 개면 엑셀처럼 아래쪽 탭으로 전환. */}
      <div
        role="tablist"
        aria-label="시트"
        className="flex shrink-0 gap-0.5 overflow-x-auto border-t border-slate-200 bg-slate-100 px-2"
      >
        {sheets.map((item, index) => (
          <button
            key={`${item.name}-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`-mt-px cursor-pointer whitespace-nowrap border-x border-b px-4 py-1.5 text-xs transition ${index === active ? "border-slate-200 bg-white font-semibold text-emerald-700 shadow-[inset_0_-2px_0_#047857]" : "border-transparent text-slate-600 hover:bg-slate-200"}`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
