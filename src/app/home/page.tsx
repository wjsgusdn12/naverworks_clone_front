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

const subscribeToDemoAuthentication = () => () => {};
const getServerAuthenticationSnapshot = () => false;

export default function HomePage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const isAuthorized = useSyncExternalStore(
    subscribeToDemoAuthentication,
    isDemoAuthenticated,
    getServerAuthenticationSnapshot,
  );
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isDemoAuthenticated()) {
      markAuthenticationRequired();
      router.replace("/");
      return;
    }

  }, [isAuthorized, router]);

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    clearDemoAuthentication();
    router.replace("/");
  };

  if (!isAuthorized) {
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
      <HomeDashboard onFeatureClick={(featureName) => showToast(`${featureName} 기능은 준비 중입니다.`)} />
      {toast && <Toast key={toast.id} message={toast.message} phase={toast.phase} />}
    </div>
  );
}
