// 백엔드 공통 응답 형식과 일치하는 API 응답 껍데기.
type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
};

// 로그인한 사용자를 화면에서 식별하는 최소 정보.
export type AuthMember = {
  membershipId: number;
  companyId: number;
  userAccountId: number;
  email: string;
  displayName: string;
  role: "ADMIN" | "USER";
};

// 로그인·토큰 재발급 API가 반환하는 Access Token 정보.
export type AuthTokenResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  sessionExpiresAt: string;
  member: AuthMember;
};

export type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};

// HTTP 상태와 백엔드 오류 코드를 함께 보관해 화면별 안내 문구를 결정.
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const getApiBaseUrl = () => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    // 배포 주소를 코드에 고정하지 않고 환경 변수 누락을 즉시 드러냄.
    throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  }

  return apiBaseUrl.replace(/\/$/, "");
};

const toApiClientError = (status: number, response: Partial<ApiResponse<unknown>>) =>
  new ApiClientError(
    response.message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    status,
    response.code || "UNKNOWN_ERROR",
  );

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      // Refresh Token HttpOnly 쿠키를 백엔드에 자동으로 함께 전송.
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    // 네트워크 단절·서버 미기동처럼 HTTP 응답이 없는 경우를 구분.
    throw new ApiClientError("인증 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.", 0, "NETWORK_ERROR");
  }

  const responseBody = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;

  if (!response.ok || !responseBody.success || !responseBody.data) {
    throw toApiClientError(response.status, responseBody);
  }

  return responseBody.data;
};

export const authApi = {
  // 이메일과 비밀번호로 Access Token과 HttpOnly Refresh Token 쿠키를 발급.
  login: (input: LoginInput) =>
    request<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // 브라우저가 가진 HttpOnly Refresh Token 쿠키로 로그인 상태를 복구.
  refresh: () => request<AuthTokenResponse>("/api/v1/auth/refresh", { method: "POST" }),

  // 메모리에 있는 Access Token으로 현재 사용자 정보를 다시 조회.
  getCurrentMember: (accessToken: string) =>
    request<AuthMember>("/api/v1/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  logout: async () => {
    let response: Response;

    try {
      response = await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      throw new ApiClientError("인증 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.", 0, "NETWORK_ERROR");
    }

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => ({}))) as Partial<ApiResponse<unknown>>;
      throw toApiClientError(response.status, responseBody);
    }
  },
};
