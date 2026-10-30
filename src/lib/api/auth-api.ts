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
  companyName: string;
  userAccountId: number;
  loginId: string;
  // 공개 가입에서는 선택 입력이라 비어 있을 수 있음.
  email: string | null;
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
  // 아이디 또는 이메일
  loginId: string;
  password: string;
  rememberMe: boolean;
};

// 가입 시 소속을 정하는 방식: 체험 회사 참여 / 새 회사 만들기 / 초대 코드로 참여.
export type SignupJoinType = "DEMO" | "NEW_COMPANY" | "INVITE";

export type SignupInput = {
  loginId: string;
  password: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  joinType: SignupJoinType;
  departmentId?: number;
  jobGradeId?: number;
  companyName?: string;
  inviteCode?: string;
};

// 회사 옮기기 입력. 가입의 소속 선택과 같은 세 갈래.
export type CompanyMoveInput = {
  joinType: SignupJoinType;
  departmentId?: number;
  jobGradeId?: number;
  companyName?: string;
  inviteCode?: string;
};

export type SignupOption = { id: number; name: string };

// 가입 화면이 미리 보여 줄 체험 회사 정보.
export type SignupOptions = {
  demoCompanyName: string;
  departments: SignupOption[];
  jobGrades: SignupOption[];
};

// 가입 성공: 로그인 세션과 한 번만 보여 주는 복구 코드.
export type SignupResult = {
  session: AuthTokenResponse;
  recoveryCode: string;
};

export type InviteCodeResponse = { companyName: string; inviteCode: string };

// 계정 찾기 1단계 결과. 아이디는 일부가 가려져 옴.
// 계정 찾기 확인 정보. 본인 정보 세 가지 아니면 복구 코드 중 하나.
export type RecoverCredentials =
  { displayName: string; email: string; phoneNumber: string } | { recoveryCode: string };

export type RecoverLookupResult = {
  maskedLoginId: string;
  displayName: string;
  canReset: boolean;
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
    throw new ApiClientError(
      "인증 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
      0,
      "NETWORK_ERROR",
    );
  }

  const responseBody = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;

  if (!response.ok || !responseBody.success || !responseBody.data) {
    throw toApiClientError(response.status, responseBody);
  }

  return responseBody.data;
};

const bearer = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const authApi = {
  // 아이디(또는 이메일)와 비밀번호로 Access Token과 HttpOnly Refresh Token 쿠키를 발급.
  login: (input: LoginInput) =>
    request<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // 가입 화면용 체험 회사 정보(로그인 전).
  signupOptions: () => request<SignupOptions>("/api/v1/auth/signup/options", { method: "GET" }),

  // 공개 가입. 성공하면 바로 로그인 세션이 함께 옴.
  signup: (input: SignupInput) =>
    request<SignupResult>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // 계정 찾기 1단계: 아이디(또는 이메일) 아니면 복구 코드, 둘 중 하나로 계정 확인.
  // 아이디로 찾으면 가린 아이디·이름만 오고(canReset=false), 복구 코드로 찾으면 비밀번호 재설정까지 가능.
  recoverLookup: (input: RecoverCredentials) =>
    request<RecoverLookupResult>("/api/v1/auth/recover/lookup", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // 계정 찾기 2단계: 1단계와 같은 정보로 다시 확인 후 비밀번호 재설정. 새 복구 코드가 옴.
  recoverReset: (input: RecoverCredentials, newPassword: string) =>
    request<{ recoveryCode: string }>("/api/v1/auth/recover/reset", {
      method: "POST",
      body: JSON.stringify({ ...input, newPassword }),
    }),

  // 회사 옮기기. 회사 ID가 바뀌어 새 세션이 옴. 이전 회사의 채팅방·즐겨찾기는 정리됨.
  moveCompany: (accessToken: string, input: CompanyMoveInput) =>
    request<AuthTokenResponse>("/api/v1/auth/company/move", {
      method: "POST",
      headers: bearer(accessToken),
      body: JSON.stringify(input),
    }),

  // 복구 코드 재발급(내 프로필). 이전 코드는 즉시 무효.
  regenerateRecoveryCode: (accessToken: string) =>
    request<{ recoveryCode: string }>("/api/v1/auth/recoveryCode/regenerate", {
      method: "POST",
      headers: bearer(accessToken),
    }),

  // 회사 초대 코드(관리자). regenerate=true면 새 코드로 교체.
  companyInviteCode: (accessToken: string, regenerate = false) =>
    request<InviteCodeResponse>(
      regenerate ? "/api/v1/auth/company/inviteCode/regenerate" : "/api/v1/auth/company/inviteCode",
      { method: regenerate ? "POST" : "GET", headers: bearer(accessToken) },
    ),

  // 브라우저가 가진 HttpOnly Refresh Token 쿠키로 로그인 상태를 복구.
  refresh: () => request<AuthTokenResponse>("/api/v1/auth/refresh", { method: "POST" }),

  // 메모리에 있는 Access Token으로 현재 사용자 정보를 다시 조회.
  getCurrentMember: (accessToken: string) =>
    request<AuthMember>("/api/v1/auth/me", {
      method: "GET",
      headers: bearer(accessToken),
    }),

  logout: async () => {
    let response: Response;

    try {
      response = await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      throw new ApiClientError(
        "인증 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
        0,
        "NETWORK_ERROR",
      );
    }

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => ({}))) as Partial<
        ApiResponse<unknown>
      >;
      throw toApiClientError(response.status, responseBody);
    }
  },
};
