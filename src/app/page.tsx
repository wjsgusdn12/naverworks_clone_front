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
  const router = useRouter();
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (isDemoAuthenticated()) {
      router.replace("/home");
      return;
    }

    if (consumeAuthenticationRequired()) {
      showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.");
    }
  }, [router, showToast]);

  const handleLogin = ({ userId, password, rememberMe }: DemoLoginInput) => {
    if (!isDemoCredential(userId, password)) {
      showToast("아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }

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
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} />}
    </div>
  );
}
