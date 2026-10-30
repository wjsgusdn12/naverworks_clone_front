import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

// 관리자 전용 API 대시보드. 서버 ApiDashboardResponse와 같은 모양.
// mode: SHARED(Redis로 모든 서버 합산) / LOCAL(이 서버만, 로컬 개발)
export type ApiDashboardSummary = {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  // 5xx(서버 오류) 비율 %
  errorRate: number;
  avgMs: number;
  // 요청 95%가 이 시간 안에 끝남(구간 경계). -1이면 5초 초과.
  p95Ms: number;
};
// 추이 한 점. 요청이 없던 구간은 avgMs·p95Ms가 0.
export type ApiDashboardTrendPoint = {
  startAt: string;
  requests: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
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
  thisHour: ApiDashboardSummary;
  today: ApiDashboardSummary;
  thisWeek: ApiDashboardSummary;
  thisMonth: ApiDashboardSummary;
  // 이번 시간 ??:00~??:59 1분 단위 60점
  hourTrend: ApiDashboardTrendPoint[];
  // 오늘 00:00~23:59 5분 단위 288점
  dayTrend: ApiDashboardTrendPoint[];
  // 이번 주 일 00시~토 23시 1시간 단위 168점(DB의 1시간 요약)
  weekTrend: ApiDashboardTrendPoint[];
  // 이번 달 1일 00시~말일 23시 1시간 단위(DB의 1시간 요약)
  monthTrend: ApiDashboardTrendPoint[];
  hourRanking: ApiDashboardRanking;
  dayRanking: ApiDashboardRanking;
  weekRanking: ApiDashboardRanking;
  monthRanking: ApiDashboardRanking;
};

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  return value.replace(/\/$/, "");
};

export const adminApi = {
  apiDashboard: async (accessToken: string) => {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}/api/v1/admin/apiDashboard`, {
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
