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
export type ApiDashboardTrendPoint = { startAt: string; requests: number; errors: number };
export type ApiDashboardEndpoint = {
  endpoint: string;
  requests: number;
  errors: number;
  avgMs: number;
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
  mode: "SHARED" | "LOCAL";
  database: "UP" | "DOWN";
  servers: ApiDashboardServer[];
  lastHour: ApiDashboardSummary;
  lastDay: ApiDashboardSummary;
  trend: ApiDashboardTrendPoint[];
  topEndpoints: ApiDashboardEndpoint[];
  slowEndpoints: ApiDashboardEndpoint[];
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
