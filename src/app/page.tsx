"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { LoginForm } from "@/components/login/login-form";
import {
  consumeAuthenticationRequired,
  isDemoAuthenticated,
  isDemoCredential,
  saveDemoAuthentication,
  type DemoLoginInput,
} from "@/lib/demo-auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  // Next.js 페이지 이동과 공통 토스트 기능을 사용.
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();

  useEffect(() => {
    // 이미 로그인한 사용자는 로그인 화면을 다시 보지 않도록 홈으로 이동.
    if (isDemoAuthenticated()) {
      router.replace("/home");
      return;
    }

    // 보호 화면 접근으로 돌아온 경우에만 로그인 필요 안내를 표시.
    if (consumeAuthenticationRequired()) {
      showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.");
    }
  }, [router, showToast]);

  const handleLogin = ({ userId, password, rememberMe }: DemoLoginInput) => {
    // 현재는 API 호출 대신 임시 계정 정보만 검증.
    if (!isDemoCredential(userId, password)) {
      showToast("아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }

    // 브라우저에 로그인 상태를 저장한 뒤 홈 화면으로 이동.
    saveDemoAuthentication(rememberMe);
    router.push("/home");
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
