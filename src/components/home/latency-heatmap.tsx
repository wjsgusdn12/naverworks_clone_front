"use client";

import { useElementWidth } from "@/components/home/line-chart";
import { useState } from "react";

// 응답 시간 구간(아래가 빠름). 서버 MetricsBucket.LATENCY_BOUNDS_MS와 같은 9칸.
const BIN_LABELS = ["≤50ms", "≤100ms", "≤200ms", "≤300ms", "≤500ms", "≤1s", "≤2s", "≤5s", ">5s"];
const PADDING = { top: 8, right: 16, bottom: 26, left: 56 };
const HEIGHT = 220;
// 진하기 한 가지 색(파랑): 적음 → 많음
const LIGHT = [219, 234, 254];
const DARK = [30, 58, 138];

const colorOf = (ratio: number) => {
  const mix = (index: number) => Math.round(LIGHT[index] + (DARK[index] - LIGHT[index]) * ratio);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
};

// 응답 시간 히트맵(그라파나 대표 그래프). 가로는 시간 칸, 세로는 응답 시간 구간,
// 칸 색이 진할수록 그 시간·그 빠르기의 요청이 많음. 평균에 묻히는 "가끔 느린 요청"이 위쪽 칸에 보임.
// columns의 null은 값 없는 칸(아직 오지 않은 시간·큰 단위 합계에 포함된 칸)이라 비워 둠.
export function LatencyHeatmap({
  columns,
  labels,
  tooltipTitles,
  ariaLabel,
}: {
  // 칸마다 구간별 요청 수(9개)
  columns: (number[] | null)[];
  // 아래쪽 시간 글자(빈 글자는 표시 안 함)
  labels: string[];
  tooltipTitles: string[];
  ariaLabel: string;
}) {
  const { ref, width } = useElementWidth();
  const [hovered, setHovered] = useState<{ column: number; bin: number } | null>(null);
  const count = columns.length;
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const cellWidth = count > 0 ? plotWidth / count : 0;
  const cellHeight = plotHeight / BIN_LABELS.length;
  const max = Math.max(1, ...columns.flatMap((column) => column ?? []));
  // 많고 적음 차이가 커도 옅은 칸이 보이도록 제곱근으로 진하기를 정함.
  const ratioOf = (value: number) => Math.sqrt(value / max);
  const xOf = (column: number) => PADDING.left + column * cellWidth;
  // 0번 구간(가장 빠름)이 맨 아래
  const yOf = (bin: number) => PADDING.top + (BIN_LABELS.length - 1 - bin) * cellHeight;

  const pick = (event: React.MouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const column = Math.floor((event.clientX - box.left - PADDING.left) / cellWidth);
    const bin =
      BIN_LABELS.length - 1 - Math.floor((event.clientY - box.top - PADDING.top) / cellHeight);
    if (column < 0 || column >= count || bin < 0 || bin >= BIN_LABELS.length) setHovered(null);
    else setHovered({ column, bin });
  };
  const hoveredValue = hovered ? (columns[hovered.column]?.[hovered.bin] ?? null) : null;

  return (
    <div ref={ref} className="relative w-full" role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block">
          {/* 왼쪽 구간 글자(두 칸마다) */}
          {BIN_LABELS.map((label, bin) =>
            bin % 2 === 0 || bin === BIN_LABELS.length - 1 ? (
              <text
                key={label}
                x={PADDING.left - 8}
                y={yOf(bin) + cellHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-400 text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}
          {/* 바탕 */}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotWidth}
            height={plotHeight}
            fill="#f8fafc"
            rx={4}
          />
          {/* 요청이 있는 칸만 그림(0인 칸은 바탕 그대로) */}
          {columns.map((column, index) =>
            column?.map((value, bin) =>
              value > 0 ? (
                <rect
                  key={`${index}-${bin}`}
                  x={xOf(index)}
                  y={yOf(bin)}
                  width={Math.max(cellWidth, 1)}
                  height={cellHeight}
                  fill={colorOf(ratioOf(value))}
                />
              ) : null,
            ),
          )}
          {/* 마우스가 올라간 칸 테두리 */}
          {hovered && (
            <rect
              x={xOf(hovered.column)}
              y={yOf(hovered.bin)}
              width={Math.max(cellWidth, 2)}
              height={cellHeight}
              fill="none"
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          )}
          {/* 아래쪽 시간 */}
          {labels.map((label, index) =>
            label ? (
              <text
                key={`${label}-${index}`}
                x={xOf(index) + cellWidth / 2}
                y={HEIGHT - 6}
                textAnchor={index === 0 ? "start" : "middle"}
                className="fill-slate-400 text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}
          {/* 그래프 영역 전체를 마우스 영역으로 써서 칸 위치를 계산으로 찾음 */}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={pick}
            onMouseLeave={() => setHovered(null)}
          />
        </svg>
      )}
      {hovered && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            top: PADDING.top,
            left: xOf(hovered.column),
            transform: `translateX(${xOf(hovered.column) > width * 0.6 ? "calc(-100% - 12px)" : "12px"})`,
          }}
        >
          <p className="mb-1 font-semibold text-slate-800">{tooltipTitles[hovered.column]}</p>
          <p className="flex justify-between gap-4 text-slate-600">
            <span>응답 {BIN_LABELS[hovered.bin]}</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {hoveredValue === null ? "기록 없음" : `${hoveredValue.toLocaleString("ko-KR")}건`}
            </span>
          </p>
        </div>
      )}
      {/* 색 범례: 적음 → 많음 */}
      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-slate-400">
        적음
        <span
          className="h-2 w-24 rounded-full"
          style={{ background: `linear-gradient(to right, ${colorOf(0)}, ${colorOf(1)})` }}
        />
        많음
      </div>
    </div>
  );
}
