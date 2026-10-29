import { ApiClientError } from "@/lib/api/auth-api";

type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

export type PresenceStatus = "ONLINE" | "OFFLINE" | "AWAY" | "INACTIVE";

export type AddressBookOrganization = {
  companyId: number;
  companyName: string;
  currentCompany: boolean;
  // 사용 중인 계정 기준 회사 인원수.
  memberCount: number;
  departments: { id: number; name: string; enabled: boolean }[];
};

export type AddressBookMember = {
  membershipId: number;
  displayName: string;
  jobTitle: string | null;
  jobGradeName: string | null;
  departmentName: string | null;
  companyName: string;
  email: string;
  phoneNumber: string | null;
  enabled: boolean;
  presenceStatus: PresenceStatus;
  favorite: boolean;
};

export type AddressBookMemberPage = {
  content: AddressBookMember[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AddressBookMemberDetail = AddressBookMember & {
  hiredAt: string | null;
  awayUntil: string | null;
};

export type AddressBookSearchHistory = {
  id: number;
  keyword: string;
  updatedAt: string;
};

const getApiBaseUrl = () => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL 환경 변수가 필요합니다.");
  }
  return apiBaseUrl.replace(/\/$/, "");
};

const request = async <T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch (error) {
    // 입력값이 바뀌어 취소한 이전 자동완성 요청은 오류 토스트로 보이지 않게 전달.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError(
      "서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.",
      0,
      "NETWORK_ERROR",
    );
  }

  const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;
  if (!response.ok || !body.success || body.data === undefined) {
    throw new ApiClientError(
      body.message ?? "요청을 처리하지 못했습니다.",
      response.status,
      body.code ?? "UNKNOWN_ERROR",
    );
  }
  return body.data;
};

export const addressBookApi = {
  organization: (accessToken: string) =>
    request<AddressBookOrganization[]>("/api/v1/addressBook/organization", accessToken),
  member: (accessToken: string, parameters: URLSearchParams) =>
    request<AddressBookMemberPage>(
      `/api/v1/addressBook/member?${parameters.toString()}`,
      accessToken,
    ),
  memberSuggest: (accessToken: string, keyword: string, page: number, signal?: AbortSignal) =>
    request<AddressBookMemberPage>(
      `/api/v1/addressBook/member/suggest?${new URLSearchParams({ keyword, page: String(page), size: "50" }).toString()}`,
      accessToken,
      { signal },
    ),
  searchHistory: (accessToken: string) =>
    request<AddressBookSearchHistory[]>("/api/v1/addressBook/searchHistory", accessToken),
  createSearchHistory: (accessToken: string, keyword: string) =>
    request<void>("/api/v1/addressBook/searchHistory/create", accessToken, {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  deleteSearchHistory: (accessToken: string) =>
    request<void>("/api/v1/addressBook/searchHistory/delete", accessToken, { method: "POST" }),
  deleteSearchHistoryItem: (accessToken: string, searchHistoryId: number) =>
    request<void>(`/api/v1/addressBook/searchHistory/delete/${searchHistoryId}`, accessToken, {
      method: "POST",
    }),
  memberDetail: (accessToken: string, membershipId: number) =>
    request<AddressBookMemberDetail>(
      `/api/v1/addressBook/member/detail?membershipId=${membershipId}`,
      accessToken,
    ),
  createFavorite: (accessToken: string, targetMembershipId: number) =>
    request<void>("/api/v1/addressBook/favorite/create", accessToken, {
      method: "POST",
      body: JSON.stringify({ targetMembershipId }),
    }),
  deleteFavorite: (accessToken: string, targetMembershipId: number) =>
    request<void>("/api/v1/addressBook/favorite/delete", accessToken, {
      method: "POST",
      body: JSON.stringify({ targetMembershipId }),
    }),
};
