"use client";

import { LoadingState, Spinner } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import {
  adminApi,
  type ApiDashboard,
  type ApiDashboardEndpoint,
  type ApiDashboardSummary,
  type ApiDashboardTrendPoint,
} from "@/lib/api/admin-api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  RotateCw,
  Server,
  Timer,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// 이 주기마다 숫자를 새로 받음.
const REFRESH_MS = 30_000;
// 차트 색: 정상 요청(파랑)·오류 요청(빨강). 색약 구분·대비 검사를 통과한 조합.
const NORMAL_COLOR = "#3b82f6";
const ERROR_COLOR = "#ef4444";

const formatNumber = (value: number) => value.toLocaleString("ko-KR");
const formatP95 = (value: number) => (value < 0 ? "5초 초과" : `≤ ${formatNumber(value)}ms`);
const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
};
const hourLabel = (value: string) => `${new Date(value).getHours()}시`;

// 홈 화면의 관리자 전용 "API 상태". 서버 여러 대의 요청을 합친 숫자(배포)나 이 서버 숫자(로컬)를 30초마다 갱신.
export function ApiDashboardSection({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<ApiDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await adminApi.apiDashboard(accessToken));
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "[조회 실패] API 대시보드를 불러오지 못함",
      );
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Activity size={18} className="text-blue-600" aria-hidden="true" />
            API 상태
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              관리자 전용
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            최근 1시간·24시간 API 요청을 5분 단위로 모아 보여 줍니다.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {data && <ModeBadge mode={data.mode} />}
          {data && <DatabaseBadge status={data.database} />}
          {data && (
            <span>
              {new Date(data.generatedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              기준
            </span>
          )}
          <Tooltip label="지금 새로 불러오기 (30초마다 자동)">
            <button
              type="button"
              aria-label="API 상태 새로고침"
              onClick={() => void load()}
              disabled={refreshing}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 disabled:cursor-default"
            >
              {refreshing ? (
                <Spinner size={15} className="text-blue-500" />
              ) : (
                <RotateCw size={15} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {data === null ? (
        error ? (
          <p className="py-10 text-center text-sm text-slate-500">{error}</p>
        ) : (
          <LoadingState message="API 상태를 불러오는 중입니다..." className="py-10" />
        )
      ) : (
        <>
          {error && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              [갱신 실패] {error} · 마지막으로 받은 숫자를 보여 주는 중
            </p>
          )}
          <KpiRow lastHour={data.lastHour} lastDay={data.lastDay} />
          <TrendChart points={data.trend} />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <EndpointList
              title="많이 호출된 API"
              description="최근 24시간 호출 수"
              items={data.topEndpoints}
              metric="requests"
            />
            <EndpointList
              title="느린 API"
              description="최근 24시간 평균 응답 시간(5회 이상 호출)"
              items={data.slowEndpoints}
              metric="avgMs"
            />
          </div>
          <ServerList servers={data.servers} mode={data.mode} />
        </>
      )}
    </section>
  );
}

function ModeBadge({ mode }: { mode: ApiDashboard["mode"] }) {
  return (
    <Tooltip
      multiline
      label={
        mode === "SHARED"
          ? "모든 서버의 요청을 공용 저장소(Redis)에 함께 모아 합친 숫자입니다."
          : "Redis 없이 실행 중이라 지금 이 서버의 요청만 셉니다(로컬 개발). 배포 때 Redis를 켜면 서버 통합 집계로 바뀝니다."
      }
    >
      <span
        className={`rounded-full px-2 py-1 font-medium ${mode === "SHARED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
      >
        {mode === "SHARED" ? "서버 통합 집계" : "이 서버만 집계"}
      </span>
    </Tooltip>
  );
}

function DatabaseBadge({ status }: { status: ApiDashboard["database"] }) {
  const up = status === "UP";
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-1 font-medium ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
    >
      <Database size={12} aria-hidden="true" />
      DB {up ? "정상" : "연결 안 됨"}
    </span>
  );
}

// 큰 숫자 4개: 요청 수 · 서버 오류율 · 평균 응답 · p95 응답. 큰 글씨는 최근 1시간, 작은 글씨는 24시간.
function KpiRow({
  lastHour,
  lastDay,
}: {
  lastHour: ApiDashboardSummary;
  lastDay: ApiDashboardSummary;
}) {
  const tiles = [
    {
      label: "요청 수",
      icon: Activity,
      value: `${formatNumber(lastHour.requests)}건`,
      sub: `24시간 ${formatNumber(lastDay.requests)}건`,
      help: "API가 처리한 요청 개수",
    },
    {
      label: "서버 오류율",
      icon: lastHour.serverErrors > 0 ? AlertTriangle : CheckCircle2,
      value: `${lastHour.errorRate}%`,
      sub: `5xx ${formatNumber(lastHour.serverErrors)} · 4xx ${formatNumber(lastHour.clientErrors)}`,
      help: "서버 잘못(5xx)으로 실패한 비율. 4xx는 잘못된 요청·권한 없음처럼 요청 쪽 문제",
      warn: lastHour.serverErrors > 0,
    },
    {
      label: "평균 응답",
      icon: Timer,
      value: `${formatNumber(lastHour.avgMs)}ms`,
      sub: `24시간 ${formatNumber(lastDay.avgMs)}ms`,
      help: "요청 하나를 처리하는 데 걸린 평균 시간",
    },
    {
      label: "p95 응답",
      icon: Gauge,
      value: formatP95(lastHour.p95Ms),
      sub: `24시간 ${formatP95(lastDay.p95Ms)}`,
      help: "100건 중 95건이 이 시간 안에 끝남. 평균에 묻히는 느린 요청을 잡아내는 숫자",
    },
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Tooltip key={tile.label} label={tile.help} multiline className="block">
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <tile.icon
                size={14}
                className={tile.warn ? "text-red-500" : "text-slate-400"}
                aria-hidden="true"
              />
              {tile.label} · 최근 1시간
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{tile.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{tile.sub}</p>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

// 24시간 시간별 요청 막대. 한 막대 = 1시간, 아래쪽 파랑은 정상·위쪽 빨강은 오류(4xx+5xx).
function TrendChart({ points }: { points: ApiDashboardTrendPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.requests));
  const total = points.reduce((sum, point) => sum + point.requests, 0);
  const hoveredPoint = hovered === null ? null : points[hovered];
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">시간별 요청 (최근 24시간)</h3>
        {/* 범례: 색만으로 구분하지 않도록 이름을 함께 표시. */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NORMAL_COLOR }} />
            정상
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ERROR_COLOR }} />
            오류
          </span>
        </div>
      </div>
      {total === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">
          아직 기록된 요청이 없습니다.
        </p>
      ) : (
        <div className="relative mt-3">
          <div className="flex h-36 items-end gap-0.5 border-b border-slate-200">
            {points.map((point, index) => {
              const normal = point.requests - point.errors;
              const height = (point.requests / max) * 100;
              return (
                // 막대보다 넓은 칸 전체를 마우스 영역으로 써서 가는 막대도 쉽게 가리킬 수 있게 함.
                <div
                  key={point.startAt}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  className={`flex h-full flex-1 flex-col justify-end rounded-t ${hovered === index ? "bg-slate-50" : ""}`}
                  aria-label={`${hourLabel(point.startAt)} 요청 ${point.requests}건, 오류 ${point.errors}건`}
                >
                  <div
                    className="flex flex-col gap-0.5 overflow-hidden rounded-t"
                    style={{ height: `${height}%` }}
                  >
                    {point.errors > 0 && (
                      <span
                        className="w-full shrink-0"
                        style={{
                          background: ERROR_COLOR,
                          flexGrow: point.errors,
                          minHeight: 2,
                        }}
                      />
                    )}
                    {normal > 0 && (
                      <span
                        className="w-full"
                        style={{ background: NORMAL_COLOR, flexGrow: normal }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex text-[11px] text-slate-400">
            {points.map((point, index) => (
              <span key={point.startAt} className="flex-1 text-center">
                {index % 6 === 0 ? hourLabel(point.startAt) : ""}
              </span>
            ))}
          </div>
          <span className="absolute -top-5 left-0 text-[11px] text-slate-400">
            최대 {formatNumber(max)}건
          </span>
          {hoveredPoint && hovered !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((hovered + 0.5) / points.length) * 100}%` }}
            >
              <p className="font-semibold text-slate-800">
                {hourLabel(hoveredPoint.startAt)}~
                {(new Date(hoveredPoint.startAt).getHours() + 1) % 24}시
              </p>
              <p className="mt-0.5 text-slate-600">
                요청 {formatNumber(hoveredPoint.requests)}건 · 오류{" "}
                {formatNumber(hoveredPoint.errors)}건
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// "GET /api/v1/chatRoom" → 방식 딱지 + 주소
function EndpointName({ endpoint }: { endpoint: string }) {
  const [method, ...rest] = endpoint.split(" ");
  const path = rest.join(" ");
  if (!path) return <span className="truncate text-slate-600">{endpoint}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${method === "GET" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}
      >
        {method}
      </span>
      <span className="truncate font-mono text-xs text-slate-700" title={path}>
        {path}
      </span>
    </span>
  );
}

function EndpointList({
  title,
  description,
  items,
  metric,
}: {
  title: string;
  description: string;
  items: ApiDashboardEndpoint[];
  metric: "requests" | "avgMs";
}) {
  const max = Math.max(1, ...items.map((item) => item[metric]));
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 py-6 text-center text-xs text-slate-500">
          아직 기록이 없습니다.
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.endpoint} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <EndpointName endpoint={item.endpoint} />
                <span className="shrink-0 text-xs tabular-nums text-slate-600">
                  {metric === "requests"
                    ? `${formatNumber(item.requests)}회`
                    : `${formatNumber(item.avgMs)}ms`}
                  {item.errors > 0 && (
                    <span className="ml-1.5 text-red-600">오류 {formatNumber(item.errors)}</span>
                  )}
                </span>
              </div>
              {/* 1등 대비 상대 길이 */}
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(item[metric] / max) * 100}%`, background: NORMAL_COLOR }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// 지금 살아 있는 서버 목록. 10초마다 보고하고, 30초 끊기면 목록에서 빠짐.
function ServerList({
  servers,
  mode,
}: {
  servers: ApiDashboard["servers"];
  mode: ApiDashboard["mode"];
}) {
  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Server size={15} className="text-slate-400" aria-hidden="true" />
        가동 중인 서버 {servers.length}대
      </h3>
      <p className="text-xs text-slate-500">
        {mode === "SHARED"
          ? "각 서버가 10초마다 상태를 보고합니다. 30초 동안 보고가 없으면 꺼진 것으로 보고 목록에서 뺍니다."
          : "로컬 개발 중에는 지금 이 서버 한 대만 보입니다."}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 font-medium">서버</th>
              <th className="py-2 font-medium">가동 시간</th>
              <th className="py-2 font-medium">메모리</th>
              <th className="py-2 text-right font-medium">실시간 연결</th>
            </tr>
          </thead>
          <tbody>
            {servers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-slate-500">
                  <XCircle size={14} className="mr-1 inline text-red-500" aria-hidden="true" />
                  보고 중인 서버가 없습니다.
                </td>
              </tr>
            ) : (
              servers.map((server) => {
                const ratio = server.heapMaxMb > 0 ? server.heapUsedMb / server.heapMaxMb : 0;
                return (
                  <tr key={server.instanceId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
                        <span className="font-mono text-xs text-slate-800">
                          {server.instanceId}
                        </span>
                        {server.current && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            지금 응답한 서버
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      {formatUptime(server.uptimeSeconds)}
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 rounded-full bg-slate-100">
                          <span
                            className={`block h-full rounded-full ${ratio > 0.85 ? "bg-red-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                          />
                        </span>
                        <span className="text-xs tabular-nums text-slate-600">
                          {formatNumber(server.heapUsedMb)} / {formatNumber(server.heapMaxMb)}MB
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-xs tabular-nums text-slate-600">
                      {formatNumber(server.realtimeConnections)}개
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
