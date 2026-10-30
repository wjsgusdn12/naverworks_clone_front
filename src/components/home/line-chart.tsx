"use client";

import { useEffect, useRef, useState } from "react";

// 선 그래프 한 줄(계열). dashed면 점선으로 그려 색뿐 아니라 모양으로도 구분.
// values의 null은 "값 없음"(예: 요청이 없던 구간의 응답 시간)이라 선을 끊음.
// connectGaps면 끊지 않고 값 없는 칸을 건너뛰어 앞뒤 점을 바로 이음(응답 시간처럼 흐름을 볼 때).
export type LineSeries = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  connectGaps?: boolean;
  values: (number | null)[];
};

const PADDING = { top: 12, right: 16, bottom: 26, left: 48 };
const HEIGHT = 200;

// 눈금을 보기 좋은 숫자(1·2·5 단위)로 올림. 예: 37 → 40, 230 → 250
const niceCeil = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
};

// 부모 폭에 맞춰 그리기 위해 실제 폭을 잼(창 크기를 바꾸면 다시 잼).
function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

// 점과 선으로 이은 추이 그래프. 가로 눈금선은 점선, 마우스를 올리면 점선 세로줄과 그 시점의 값들을 보여 줌.
export function LineChart({
  labels,
  tooltipTitles,
  series,
  formatValue,
  labelEvery,
  ariaLabel,
  showMarkers = true,
}: {
  // 아래쪽 시간 글자(점마다 하나)
  labels: string[];
  // 마우스를 올렸을 때 제목(예: "13시~14시")
  tooltipTitles: string[];
  series: LineSeries[];
  formatValue: (value: number) => string;
  // 아래쪽 글자를 몇 칸마다 보여 줄지
  labelEvery: number;
  ariaLabel: string;
  // false면 점을 숨기고 마우스가 올라간 시점만 점을 보여 줌(오늘 288점·이번 달 744점처럼 촘촘할 때).
  showMarkers?: boolean;
}) {
  const { ref, width } = useElementWidth();
  const [hovered, setHovered] = useState<number | null>(null);
  const count = labels.length;
  const values = series.flatMap((item) =>
    item.values.filter((value): value is number => value !== null),
  );
  const max = niceCeil(Math.max(0, ...values));
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) =>
    PADDING.left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - (value / max) * plotHeight;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);

  // null에서 끊어 여러 조각의 선으로 만듦(connectGaps면 null을 건너뛰고 이음).
  const pathOf = (items: (number | null)[], connectGaps = false) => {
    let path = "";
    let drawing = false;
    items.forEach((value, index) => {
      if (value === null) {
        if (!connectGaps) drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
      drawing = true;
    });
    return path;
  };

  // 앞뒤가 비어 선으로 이어지지 않는 혼자인 값. 점을 숨기는 그래프에서도 이런 점은 보여 줘야 값이 안 사라짐.
  // (이어 그리는 계열은 값이 하나뿐일 때만 혼자)
  const isolated = (series: LineSeries, index: number) =>
    series.connectGaps
      ? series.values.filter((value) => value !== null).length === 1
      : (series.values[index - 1] ?? null) === null && (series.values[index + 1] ?? null) === null;

  // 마우스 x 위치에서 가장 가까운 칸 번호. 점이 수백 개여도 칸마다 영역을 만들지 않고 계산으로 찾음.
  const indexAt = (mouseX: number) => {
    if (count <= 1) return 0;
    const ratio = (mouseX - PADDING.left) / plotWidth;
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
  };
  return (
    <div ref={ref} className="relative w-full" role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block overflow-visible">
          {/* 가로 눈금선(점선)과 왼쪽 값 */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#e2e8f0"
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text
                x={PADDING.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-400 text-[11px]"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}
          {/* 아래쪽 시간 */}
          {labels.map((label, index) =>
            index % labelEvery === 0 && label ? (
              <text
                key={`${label}-${index}`}
                x={x(index)}
                y={HEIGHT - 6}
                textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
                className="fill-slate-400 text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}
          {/* 마우스가 올라간 시점의 세로 점선 */}
          {hovered !== null && (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
          )}
          {series.map((item) => (
            <g key={item.key}>
              <path
                d={pathOf(item.values, item.connectGaps)}
                fill="none"
                stroke={item.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={item.dashed ? "6 5" : undefined}
              />
              {/* 각 시점의 점(모든 계열 같은 모양: 채운 점 + 흰 테두리). 점이 너무 촘촘하면 마우스 위치만 표시. */}
              {item.values.map((value, index) =>
                value === null ||
                (!showMarkers && hovered !== index && !isolated(item, index)) ? null : (
                  <circle
                    key={index}
                    cx={x(index)}
                    cy={y(value)}
                    r={hovered === index ? 5 : 4}
                    fill={item.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                ),
              )}
            </g>
          ))}
          {/* 그래프 영역 전체를 마우스 영역으로 써서 가장 가까운 시점을 가리킴. */}
          <rect
            x={PADDING.left - 8}
            y={PADDING.top}
            width={plotWidth + 16}
            height={plotHeight}
            fill="transparent"
            onMouseMove={(event) =>
              setHovered(
                indexAt(
                  event.clientX - event.currentTarget.ownerSVGElement!.getBoundingClientRect().left,
                ),
              )
            }
            onMouseLeave={() => setHovered(null)}
          />
        </svg>
      )}
      {hovered !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            top: PADDING.top,
            left: x(hovered),
            transform: `translateX(${x(hovered) > width * 0.6 ? "calc(-100% - 12px)" : "12px"})`,
          }}
        >
          <p className="mb-1 font-semibold text-slate-800">{tooltipTitles[hovered]}</p>
          {series.map((item) => (
            <p key={item.key} className="flex items-center gap-2 text-slate-600">
              <LegendSwatch color={item.color} dashed={item.dashed} />
              <span className="flex-1">{item.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {item.values[hovered] === null ? "기록 없음" : formatValue(item.values[hovered]!)}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// 범례·툴팁에 쓰는 작은 선 견본(점선 계열은 점선으로).
export function LegendSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="18" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        x2="17"
        y1="4"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashed ? "4 3" : undefined}
        strokeLinecap="round"
      />
      <circle cx="9" cy="4" r="2.5" fill={color} stroke="#fff" strokeWidth="1" />
    </svg>
  );
}

// 목록 옆 작은 추이선. 마지막 점만 강조해 "지금" 값을 보여 줌.
// 칸이 적으면 점선, 많으면(오늘 288칸·이번 달 744칸) 점선 무늬가 뭉개지므로 가는 실선으로 그림.
export function Sparkline({
  values,
  color,
  label,
}: {
  values: (number | null)[];
  color: string;
  label: string;
}) {
  const width = 96;
  const height = 28;
  const numbers = values.filter((value): value is number => value !== null);
  const max = Math.max(1, ...numbers);
  const dense = values.length > 48;
  const step = values.length > 1 ? (width - 6) / (values.length - 1) : 0;
  const point = (value: number, index: number) => ({
    x: 3 + index * step,
    y: height - 3 - (value / max) * (height - 6),
  });
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const { x, y } = point(value, index);
    path += `${drawing ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    drawing = true;
  });
  const lastIndex = values.findLastIndex((value) => value !== null);
  const last = lastIndex >= 0 ? point(values[lastIndex]!, lastIndex) : null;
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="shrink-0">
      <title>{label}</title>
      <line x1="0" x2={width} y1={height - 3} y2={height - 3} stroke="#e2e8f0" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={dense ? 1.25 : 1.5}
        strokeDasharray={dense ? undefined : "3 3"}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && (
        <circle cx={last.x} cy={last.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
      )}
    </svg>
  );
}
