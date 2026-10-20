"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { Toast } from "@/components/common/toast";
import { HomeDashboard } from "@/components/home/home-dashboard";
import {
  clearDemoAuthentication,
  isDemoAuthenticated,
  markAuthenticationRequired,
} from "@/lib/demo-auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

// 데모 인증값은 브라우저 저장소에 있으므로 구독은 필요하지 않음.
const subscribeToDemoAuthentication = () => () => {};
// 서버 렌더링 중에는 브라우저 저장소가 없으므로 항상 비로그인으로 처리.
const getServerAuthenticationSnapshot = () => false;

export default function HomePage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  // 서버·클라이언트 렌더링 차이 없이 현재 인증 상태를 읽음.
  const isAuthorized = useSyncExternalStore(
    subscribeToDemoAuthentication,
    isDemoAuthenticated,
    getServerAuthenticationSnapshot,
  );
  // 프로필 아이콘 아래 메뉴의 열림 상태.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    // 주소를 직접 입력해도 로그인하지 않았다면 로그인 화면으로 보냄.
    if (!isDemoAuthenticated()) {
      markAuthenticationRequired();
      router.replace("/");
      return;
    }

  }, [isAuthorized, router]);

  const handleLogout = () => {
    // 메뉴를 닫고 인증 표시를 삭제한 뒤 로그인 화면으로 이동.
    setIsProfileMenuOpen(false);
    clearDemoAuthentication();
    router.replace("/");
  };

  if (!isAuthorized) {
    // 화면 전환 전에는 빈 배경만 보여 보호 화면 내용을 노출하지 않음.
    return <div className="min-h-screen bg-slate-100" />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <GlobalHeader
        isProfileMenuOpen={isProfileMenuOpen}
        onHomeAction={() => router.push("/home")}
        onServiceAction={(label) => showToast(`${label} 기능은 준비 중입니다.`)}
        onProfileAction={() => setIsProfileMenuOpen((open) => !open)}
        onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
        onLogout={handleLogout}
      />
      {/* 아직 연결되지 않은 홈 기능은 공통 안내 토스트로 처리. */}
      <HomeDashboard onFeatureClick={(featureName) => showToast(`${featureName} 기능은 준비 중입니다.`)} />
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} />}
    </div>
  );
}
