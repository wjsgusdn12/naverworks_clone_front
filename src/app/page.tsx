"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { PageLoading } from "@/components/common/loading";
import { LoginForm } from "@/components/login/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, type LoginInput } from "@/lib/api/auth-api";
import { consumeAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  // Next.js 페이지 이동과 공통 토스트 기능을 사용.
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { status, login } = useAuth();
  // 첫 로그인 상태 확인(새로고침 시 세션 복구)이 끝났는지.
  const [initialCheckDone, setInitialCheckDone] = useState(false);
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

  // 처음 로그인 상태를 확인하는 동안에는 로그인 폼 대신 로딩 표시. 이미 로그인된 사용자에게 폼이 잠깐 보이지 않게 함.
  // 로그인 버튼을 눌렀을 때도 status가 loading이 되므로, 첫 확인이 끝난 뒤에는 폼을 그대로 둠.
  if (!initialCheckDone && status !== "loading") setInitialCheckDone(true);
  if (!initialCheckDone || status === "authenticated") {
    return <PageLoading message="로그인 상태를 확인하는 중입니다." />;
  }

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
          onRecover={() => router.push("/recover")}
          loginIdInputRef={loginIdInputRef}
        />
      </main>
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
