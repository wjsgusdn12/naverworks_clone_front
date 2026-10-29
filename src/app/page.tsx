"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { LoginForm } from "@/components/login/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, type LoginInput } from "@/lib/api/auth-api";
import { consumeAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Home() {
  // Next.js 페이지 이동과 공통 토스트 기능을 사용.
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { status, login } = useAuth();
  // 헤더 아이콘을 누르면 안내 토스트와 함께 아이디 칸으로 포커스를 보냄.
  const loginIdInputRef = useRef<HTMLInputElement | null>(null);
  const requireLogin = () => {
    showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.");
    loginIdInputRef.current?.focus();
  };

  useEffect(() => {
    // 이미 로그인한 사용자는 로그인 화면을 다시 보지 않도록 홈으로 이동.
    if (status === "authenticated") {
      router.replace("/home");
      return;
    }

    // 보호 화면 접근으로 돌아온 경우에만 로그인 필요 안내를 표시.
    if (consumeAuthenticationRequired()) {
      showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.");
    }
  }, [router, showToast, status]);

  const handleLogin = async (input: LoginInput) => {
    try {
      await login(input);
      router.replace("/home");
    } catch (error) {
      // 인증 실패와 네트워크 오류 모두 서버가 전달한 안내 문구를 우선 표시.
      if (error instanceof ApiClientError) {
        showToast(error.message);
        // LoginForm이 인증 실패 입력칸을 빨간색으로 표시할 수 있게 오류를 다시 전달.
        throw error;
      }

      showToast("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      throw error;
    }
  };

  // 헤더는 고정, 스크롤은 헤더 아래 영역에서만 생기도록 화면 높이를 고정.
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <GlobalHeader
        role="USER"
        onHomeAction={requireLogin}
        onServiceAction={requireLogin}
        onProfileAction={requireLogin}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-12 sm:px-8">
        <LoginForm
          onToast={showToast}
          onLogin={handleLogin}
          onSignup={() => router.push("/signup")}
          onRecover={() => showToast("계정 찾기 기능은 준비 중입니다.")}
          loginIdInputRef={loginIdInputRef}
        />
      </main>
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
