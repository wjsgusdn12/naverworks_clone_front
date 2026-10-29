"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { RecoveryCodeDialog } from "@/components/common/recovery-code-dialog";
import { Toast } from "@/components/common/toast";
import { RecoverForm } from "@/components/login/recover-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RecoverPage() {
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { status } = useAuth();
  // 재설정 뒤 한 번만 보여 줄 새 복구 코드. 확인하면 로그인 화면으로.
  const [nextRecoveryCode, setNextRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    // 로그인 상태면 계정 찾기가 필요 없으니 홈으로.
    if (status === "authenticated") router.replace("/home");
  }, [router, status]);

  const requireLogin = () => showToast("로그인이 필요합니다. 로그인 후 이용해 주세요.");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <GlobalHeader
        role="USER"
        onHomeAction={requireLogin}
        onServiceAction={requireLogin}
        onProfileAction={requireLogin}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-12 sm:px-8">
        <RecoverForm
          onToast={showToast}
          onReset={setNextRecoveryCode}
          onBackToLogin={() => router.push("/")}
        />
      </main>
      {nextRecoveryCode && (
        <RecoveryCodeDialog
          code={nextRecoveryCode}
          title="비밀번호를 변경했습니다"
          description="방금 쓴 복구 코드는 버려졌고 새 코드가 발급되었습니다. 다시 보관해 주세요. 다른 기기의 로그인은 모두 해제됩니다."
          confirmLabel="로그인하러 가기"
          onClose={() => router.replace("/")}
        />
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
