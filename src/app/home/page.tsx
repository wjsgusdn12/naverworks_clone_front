"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { useAuth } from "@/components/auth/auth-provider";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const { toast, showToast, dismissToast, resetToast } = useToast();
  const { status, member, logout } = useAuth();
  // 프로필 아이콘 아래 메뉴의 열림 상태.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  if (status !== "authenticated" || !member) {
    // 화면 전환 전에는 빈 배경만 보여 보호 화면 내용을 노출하지 않음.
    return <div className="min-h-screen bg-slate-100" />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <GlobalHeader
        role={member.role}
        isProfileMenuOpen={isProfileMenuOpen}
        onHomeAction={() => router.push("/home")}
        onServiceAction={(label) => label === "메시지" ? router.push("/message") : ["주소록", "조직도"].includes(label) ? router.push("/addressBook") : showToast(`${label} 기능은 준비 중입니다.`)}
        onProfileAction={() => setIsProfileMenuOpen((open) => !open)}
        onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
        onLogout={() => void handleLogout()}
        profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`}
        profileName={member.displayName}
        isAuthenticated
      />
      {/* 아직 연결되지 않은 홈 기능은 공통 안내 토스트로 처리. */}
      <HomeDashboard
        displayName={member.displayName}
        onFeatureClick={(featureName) => featureName === "메시지" ? router.push("/message") : showToast(`${featureName} 기능은 준비 중입니다.`)}
      />
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />}
    </div>
  );
}
