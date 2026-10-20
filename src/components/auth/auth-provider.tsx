"use client";

import {
  ApiClientError,
  authApi,
  type AuthMember,
  type LoginInput,
} from "@/lib/api/auth-api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthenticationStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthenticationStatus;
  accessToken: string | null;
  member: AuthMember | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  // Access Token은 localStorage에 저장하지 않고, 탭 메모리에서만 유지.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [member, setMember] = useState<AuthMember | null>(null);
  const [status, setStatus] = useState<AuthenticationStatus>("loading");

  const clearAuthentication = useCallback(() => {
    setAccessToken(null);
    setMember(null);
    setStatus("unauthenticated");
  }, []);

  const establishAuthentication = useCallback((token: string, authenticatedMember: AuthMember) => {
    setAccessToken(token);
    setMember(authenticatedMember);
    setStatus("authenticated");
  }, []);

  const restoreAuthentication = useCallback(async () => {
    try {
      const refreshedSession = await authApi.refresh();
      // refresh 응답만 신뢰하지 않고 보호 API도 호출해 토큰 사용 가능 여부를 확인.
      const currentMember = await authApi.getCurrentMember(refreshedSession.accessToken);
      establishAuthentication(refreshedSession.accessToken, currentMember);
    } catch (error) {
      // Refresh Token이 없거나 만료된 첫 방문은 정상적인 비로그인 상태.
      if (!(error instanceof ApiClientError) || error.status !== 401) {
        console.error("로그인 상태 복구에 실패했습니다.", error);
      }
      clearAuthentication();
    }
  }, [clearAuthentication, establishAuthentication]);

  useEffect(() => {
    // 비동기 작업으로 넘겨 React 렌더링 직후 상태를 안전하게 갱신.
    void Promise.resolve().then(restoreAuthentication);
  }, [restoreAuthentication]);

  const login = useCallback(
    async (input: LoginInput) => {
      const authenticatedSession = await authApi.login(input);
      establishAuthentication(authenticatedSession.accessToken, authenticatedSession.member);
    },
    [establishAuthentication],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // 서버 통신 실패 시에도 브라우저의 화면 상태는 즉시 로그아웃 처리.
      clearAuthentication();
    }
  }, [clearAuthentication]);

  const value = useMemo(
    () => ({ status, accessToken, member, login, logout }),
    [status, accessToken, member, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }

  return context;
}
