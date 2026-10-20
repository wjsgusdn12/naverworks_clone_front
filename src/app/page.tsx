"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { LoginForm } from "@/components/login/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, type LoginInput } from "@/lib/api/auth-api";
import { consumeAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  // Next.js 페이지 이동과 공통 토스트 기능을 사용.
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { status, login } = useAuth();

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
        return;
      }

      showToast("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <GlobalHeader
        onHomeAction={() => showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.")}
        onServiceAction={() => showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.")}
        onProfileAction={() => showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.")}
      />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <LoginForm onToast={showToast} onLogin={handleLogin} />
      </main>
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}
    </div>
  );
}
