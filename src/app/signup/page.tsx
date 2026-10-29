"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { RecoveryCodeDialog } from "@/components/common/recovery-code-dialog";
import { Toast } from "@/components/common/toast";
import { SignupForm } from "@/components/login/signup-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { SignupResult } from "@/lib/api/auth-api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { status, applySession } = useAuth();
  // 가입 직후 한 번만 보여 줄 복구 코드. 확인을 누르면 홈으로 이동.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    // 이미 로그인한 사용자가 가입 화면에 오면 홈으로. 단, 방금 가입해 코드를 보는 중이면 그대로 둠.
    if (status === "authenticated" && recoveryCode === null) router.replace("/home");
  }, [recoveryCode, router, status]);

  const handleSignedUp = (result: SignupResult) => {
    setRecoveryCode(result.recoveryCode);
    applySession(result.session);
  };

  const requireLogin = () => showToast("로그인이 필요합니다. 가입 후 이용해 주세요.");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <GlobalHeader
        role="USER"
        onHomeAction={requireLogin}
        onServiceAction={requireLogin}
        onProfileAction={requireLogin}
      />
      <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 py-10 sm:px-8">
        <SignupForm
          onToast={showToast}
          onSignedUp={handleSignedUp}
          onBackToLogin={() => router.push("/")}
        />
      </main>
      {recoveryCode && (
        <RecoveryCodeDialog
          code={recoveryCode}
          title="가입이 완료되었습니다"
          description="비밀번호를 잊었을 때 쓰는 복구 코드입니다. 지금 복사해 안전한 곳에 보관해 주세요."
          confirmLabel="확인했어요, 시작하기"
          onClose={() => router.replace("/home")}
        />
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
