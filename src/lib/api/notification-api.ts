import { trackRequest } from "@/lib/api/request-tracker";
import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = { success: boolean; code: string; message: string; data: T };

// 알림 패널의 칩과 같은 분류. 서버 enum(NotificationCategory)과 이름을 맞춤.
export type NotificationCategory = "MESSAGE" | "ADDRESS_BOOK" | "SYSTEM";

export type NotificationItem = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  linkPath: string | null;
  read: boolean;
  createdAt: string;
};

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  return value.replace(/\/$/, "");
};

const request = async <T>(path: string, accessToken: string, init: RequestInit = {}) => {
  let response: Response;
  try {
    response = await trackRequest(
      fetch(`${apiBaseUrl()}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...init.headers,
        },
      }),
    );
  } catch {
    throw new ApiClientError(
      "알림 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
      0,
      "NETWORK_ERROR",
    );
  }
  const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;
  if (!response.ok || !body.success || body.data === undefined)
    throw new ApiClientError(
      body.message ?? "알림 요청을 처리하지 못했습니다.",
      response.status,
      body.code ?? "UNKNOWN_ERROR",
    );
  return body.data;
};

export const notificationApi = {
  // 최근 30일 알림. category를 생략하면 전체.
  list: (token: string, category?: NotificationCategory) =>
    request<NotificationItem[]>(
      `/api/v1/notification${category ? `?category=${category}` : ""}`,
      token,
    ),
  read: (token: string, notificationId: number) =>
    request<NotificationItem>(`/api/v1/notification/read?notificationId=${notificationId}`, token, {
      method: "POST",
    }),
  readAll: (token: string) =>
    request<number>("/api/v1/notification/readAll", token, { method: "POST" }),
};
