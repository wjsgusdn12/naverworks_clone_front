import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

// 관리자 전용 API 대시보드. 서버 ApiDashboardResponse와 같은 모양.
// 화면이 고른 기간(range) 하나만 담음. mode: SHARED(서버 목록 통합) / LOCAL(서버 목록은 이 서버만). 집계는 항상 DB 기준.
export type ApiDashboardSummary = {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  // 5xx(서버 오류) 비율 %
  errorRate: number;
  avgMs: number;
  // 요청 95%가 이 시간 안에 끝남(구간 안 비례 계산한 추정값). -1이면 5초 초과.
  p95Ms: number;
};
// 추이 한 점. 요청이 없던 구간은 avgMs·p95Ms가 0.
export type ApiDashboardTrendPoint = {
  startAt: string;
  requests: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
  // 이 점이 담은 시간(분). 보통은 그래프 한 칸 길이, 잘게 쪼갠 기록이 없는 구간을 큰 단위(1시간·5분 합계)로
  // 채운 점은 그 길이, 그 묶음에 포함돼 따로 값이 없는 나머지 칸은 0(빈칸으로 그림).
  spanMinutes: number;
  // 응답 시간 구간별 요청 수(50·100·200·300·500ms·1·2·5초 이하, 5초 초과 9칸, 히트맵용)
  latency: number[];
};
export type ApiDashboardEndpoint = {
  endpoint: string;
  requests: number;
  errors: number;
  avgMs: number;
  // 순위의 bins 칸마다 호출 수·평균 응답 시간(작은 추이선용)
  trendRequests: number[];
  trendAvgMs: number[];
};
// 기간별 API 순위. bins는 작은 추이선 칸의 시작 시각(이번 시간 1분×60, 오늘 5분×288, 이번 주 1일×7, 이번 달 1시간×말일×24).
export type ApiDashboardRanking = {
  bins: string[];
  top: ApiDashboardEndpoint[];
  slow: ApiDashboardEndpoint[];
};
export type ApiDashboardServer = {
  instanceId: string;
  startedAt: string;
  uptimeSeconds: number;
  heapUsedMb: number;
  heapMaxMb: number;
  realtimeConnections: number;
  current: boolean;
};
export type ApiDashboard = {
  generatedAt: string;
  // 이번 시간·오늘·이번 주를 자르는 기준 시간대(예: Asia/Seoul)
  zone: string;
  mode: "SHARED" | "LOCAL";
  database: "UP" | "DOWN";
  servers: ApiDashboardServer[];
  range: ApiDashboardRange;
  summary: ApiDashboardSummary;
  // HOUR 이번 시간 1분×60, DAY 오늘 5분×288, WEEK 이번 주(일~토) 1시간×168, MONTH 이번 달 1시간×말일×24
  trend: ApiDashboardTrendPoint[];
  ranking: ApiDashboardRanking;
};
// 기간 탭: 이번 시간·오늘·이번 주·이번 달
export type ApiDashboardRange = "HOUR" | "DAY" | "WEEK" | "MONTH";

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  return value.replace(/\/$/, "");
};

export const adminApi = {
  // 고른 기간 하나만 받음(응답 크기·서버 계산을 줄임).
  apiDashboard: async (accessToken: string, range: ApiDashboardRange) => {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}/api/v1/admin/apiDashboard?range=${range}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new ApiClientError("[연결 실패] API 서버에 연결할 수 없음", 0, "NETWORK_ERROR");
    }
    const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<ApiDashboard>>;
    if (!response.ok || !body.success || body.data === undefined)
      throw new ApiClientError(
        body.message ?? "[조회 실패] API 대시보드를 불러오지 못함",
        response.status,
        body.code ?? "UNKNOWN_ERROR",
      );
    return body.data;
  },
};
