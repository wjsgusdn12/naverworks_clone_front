"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { RecoveryCodeDialog } from "@/components/common/recovery-code-dialog";
import { Toast } from "@/components/common/toast";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { useAuth } from "@/components/auth/auth-provider";
import { authApi, type InviteCodeResponse } from "@/lib/api/auth-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const { toast, showToast, dismissToast, resetToast } = useToast();
  const { status, member, accessToken, logout } = useAuth();
  // 프로필 아이콘 아래 메뉴의 열림 상태.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // 프로필 메뉴에서 연 복구 코드·초대 코드 대화상자.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<InviteCodeResponse | null>(null);

  // 복구 코드는 해시만 저장돼 다시 볼 수 없으므로 "보기"가 곧 재발급.
  const regenerateRecoveryCode = async () => {
    if (!accessToken) return;
    setIsProfileMenuOpen(false);
    try {
      setRecoveryCode((await authApi.regenerateRecoveryCode(accessToken)).recoveryCode);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "복구 코드를 발급하지 못했습니다.");
    }
  };

  const loadInviteCode = async (regenerate: boolean) => {
    if (!accessToken) return;
    setIsProfileMenuOpen(false);
    try {
      setInviteCode(await authApi.companyInviteCode(accessToken, regenerate));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "초대 코드를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    // 주소를 직접 입력해도 로그인하지 않았다면 로그인 화면으로 보냄.
    if (status === "unauthenticated") {
      if (!isLoggingOut) markAuthenticationRequired();
      router.replace("/");
    }
  }, [isLoggingOut, router, status]);

  const handleLogout = async () => {
    // 메뉴를 닫고 인증 표시를 삭제한 뒤 로그인 화면으로 이동.
    setIsLoggingOut(true);
    setIsProfileMenuOpen(false);
    resetToast();
    await logout();
    router.replace("/");
  };

  if (status !== "authenticated" || !member || !accessToken) {
    // 화면 전환 전에는 빈 배경만 보여 보호 화면 내용을 노출하지 않음.
    return <div className="min-h-screen bg-slate-100" />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <GlobalHeader
        role={member.role}
        isProfileMenuOpen={isProfileMenuOpen}
        onHomeAction={() => router.push("/home")}
        onServiceAction={(label) =>
          label === "메시지"
            ? router.push("/message")
            : ["주소록", "조직도"].includes(label)
              ? router.push("/addressBook")
              : showToast(`${label} 기능은 준비 중입니다.`)
        }
        onProfileAction={() => setIsProfileMenuOpen((open) => !open)}
        onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
        onLogout={() => void handleLogout()}
        profileMenuItems={[
          { label: "복구 코드 재발급", onClick: () => void regenerateRecoveryCode() },
          ...(member.role === "ADMIN"
            ? [{ label: "회사 초대 코드", onClick: () => void loadInviteCode(false) }]
            : []),
        ]}
        profileLabel={`${member.displayName} · ${member.companyName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`}
        profileName={member.displayName}
        isAuthenticated
      />
      <HomeDashboard
        accessToken={accessToken}
        displayName={member.displayName}
        membershipId={member.membershipId}
        showToast={showToast}
      />
      {recoveryCode && (
        <RecoveryCodeDialog
          code={recoveryCode}
          title="새 복구 코드"
          description="비밀번호를 잊었을 때 쓰는 복구 코드입니다. 이전 코드는 더 이상 쓸 수 없습니다."
          confirmLabel="확인"
          onClose={() => setRecoveryCode(null)}
        />
      )}
      {inviteCode && (
        <RecoveryCodeDialog
          code={inviteCode.inviteCode}
          title={`${inviteCode.companyName} 초대 코드`}
          description="가입 화면에서 '초대 코드로 참여'를 고르고 이 코드를 입력하면 우리 회사 구성원이 됩니다."
          note="새로 발급하면 이전 코드는 즉시 쓸 수 없게 됩니다."
          confirmLabel="닫기"
          onRegenerate={() => void loadInviteCode(true)}
          onClose={() => setInviteCode(null)}
        />
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
