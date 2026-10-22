"use client";

import {
  ApiClientError,
  authApi,
  type AuthMember,
  type AuthTokenResponse,
  type LoginInput,
} from "@/lib/api/auth-api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthenticationStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthenticationStatus;
  accessToken: string | null;
  sessionExpiresAt: string | null;
  member: AuthMember | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  // Access Token은 localStorage에 저장하지 않고, 탭 메모리에서만 유지.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState<number | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [member, setMember] = useState<AuthMember | null>(null);
  const [status, setStatus] = useState<AuthenticationStatus>("loading");

  const clearAuthentication = useCallback(() => {
    setAccessToken(null);
    setAccessTokenExpiresAt(null);
    setSessionExpiresAt(null);
    setMember(null);
    setStatus("unauthenticated");
  }, []);

  const establishAuthentication = useCallback((session: AuthTokenResponse, authenticatedMember: AuthMember) => {
    setAccessToken(session.accessToken);
    setAccessTokenExpiresAt(Date.now() + session.expiresIn * 1000);
    setSessionExpiresAt(session.sessionExpiresAt);
    setMember(authenticatedMember);
    setStatus("authenticated");
  }, []);

  const restoreAuthentication = useCallback(async () => {
    try {
      const refreshedSession = await authApi.refresh();
      // Refresh 응답만 신뢰하지 않고 보호 API도 호출해 토큰 사용 가능 여부를 확인.
      const currentMember = await authApi.getCurrentMember(refreshedSession.accessToken);
      establishAuthentication(refreshedSession, currentMember);
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
      establishAuthentication(authenticatedSession, authenticatedSession.member);
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

  useEffect(() => {
    if (!accessToken || !accessTokenExpiresAt) return;

    // Access Token 만료 1분 전에 갱신해 사용 중인 화면의 401을 예방.
    const refreshDelay = Math.max(0, accessTokenExpiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const refreshedSession = await authApi.refresh();
          const currentMember = await authApi.getCurrentMember(refreshedSession.accessToken);
          establishAuthentication(refreshedSession, currentMember);
        } catch {
          clearAuthentication();
          window.location.replace("/");
        }
      })();
    }, refreshDelay);
    return () => window.clearTimeout(timer);
  }, [accessToken, accessTokenExpiresAt, clearAuthentication, establishAuthentication]);

  useEffect(() => {
    if (!sessionExpiresAt) return;

    // 전체 로그인 유효 시간이 끝나면 즉시 로그인 화면으로 이동.
    const sessionDelay = new Date(sessionExpiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      clearAuthentication();
      window.location.replace("/");
    }, Math.max(0, sessionDelay));
    return () => window.clearTimeout(timer);
  }, [clearAuthentication, sessionExpiresAt]);

  const value = useMemo(
    () => ({ status, accessToken, sessionExpiresAt, member, login, logout }),
    [status, accessToken, sessionExpiresAt, member, login, logout],
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
