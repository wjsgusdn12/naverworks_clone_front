"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  Bell,
  BookUser,
  Building2,
  CalendarDays,
  Grid2X2,
  Home,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { AuthMember } from "@/lib/api/auth-api";
import { useRouter } from "next/navigation";

// 상단 헤더에서 반복 렌더링할 서비스 아이콘 정보.
type HeaderAction = {
  label: string;
  icon: LucideIcon;
  requiresAdmin?: boolean;
};

// 아직 구현되지 않은 서비스도 동일한 헤더 구조로 먼저 제공.
const headerActions: HeaderAction[] = [
  { label: "홈", icon: Home },
  { label: "메시지", icon: MessageCircle },
  { label: "캘린더", icon: CalendarDays },
  { label: "주소록", icon: BookUser },
  { label: "관리자", icon: ShieldCheck, requiresAdmin: true },
  { label: "전체 서비스", icon: Grid2X2 },
  { label: "알림", icon: Bell },
  { label: "조직도", icon: Building2 },
  { label: "설정", icon: Settings },
  { label: "내 프로필", icon: UserRound },
];

// 화면마다 다른 이동·토스트 동작을 부모로부터 전달받음.
type GlobalHeaderProps = {
  onHomeAction: () => void;
  onServiceAction: (label: string) => void;
  onProfileAction: () => void;
  onCloseProfileMenu?: () => void;
  isProfileMenuOpen?: boolean;
  onLogout?: () => void;
  profileLabel?: string;
  profileName?: string;
  isAuthenticated?: boolean;
  headerContent?: ReactNode;
  pageTitle?: string;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
  role: AuthMember["role"];
};

export function GlobalHeader({
  onHomeAction,
  onServiceAction,
  onProfileAction,
  onCloseProfileMenu,
  isProfileMenuOpen = false,
  onLogout,
  profileLabel = "내 프로필",
  profileName = "",
  isAuthenticated = false,
  headerContent,
  pageTitle = "홈",
  onSidebarToggle,
  isSidebarCollapsed = false,
  role,
}: GlobalHeaderProps) {
  // 공통 헤더의 서비스 이동은 어느 화면에서나 같은 경로를 사용.
  const router = useRouter();
  // 프로필 버튼과 메뉴 영역을 함께 참조해 바깥 클릭을 판별.
  const profileMenuRef = useRef<HTMLSpanElement>(null);
  // 한글·영문·이모지 모두 글자 단위가 깨지지 않도록 앞 세 글자만 사용.
  const profileAvatarText = Array.from(profileName).slice(0, 3).join("") || "사용자";

  useEffect(() => {
    if (!isProfileMenuOpen || !onCloseProfileMenu) {
      return;
    }

    // 메뉴 영역 밖을 클릭하면 열린 프로필 메뉴를 닫음.
    const closeProfileMenuOnOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        onCloseProfileMenu();
      }
    };

    // 키보드 사용자도 Esc로 메뉴를 닫을 수 있게 처리.
    const closeProfileMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseProfileMenu();
      }
    };

    document.addEventListener("mousedown", closeProfileMenuOnOutsideClick);
    document.addEventListener("keydown", closeProfileMenuOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeProfileMenuOnOutsideClick);
      document.removeEventListener("keydown", closeProfileMenuOnEscape);
    };
  }, [isProfileMenuOpen, onCloseProfileMenu]);

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-6 bg-zinc-950 px-5 text-white shadow-sm sm:px-8">
      <div className="flex min-w-fit items-center gap-8">
        {onSidebarToggle && <button type="button" aria-label={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-transparent text-white transition duration-200 hover:scale-105 hover:bg-zinc-800 active:scale-95" onClick={onSidebarToggle}><Menu size={21} /></button>}
        <button
          type="button"
          aria-label="홈으로 이동"
          className="cursor-pointer rounded-md text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={onHomeAction}
        >
          <span className="block text-xs font-bold tracking-[0.16em]">NAVER WORKS</span>
          <span className="block text-[8px] tracking-[0.28em] text-zinc-400">COLLABORATION</span>
        </button>
        <span className="text-lg font-semibold">
          {pageTitle}
        </span>
      </div>

      {headerContent && <div className="min-w-0 flex-1">{headerContent}</div>}

      <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:overflow-visible" aria-label="주요 서비스">
        {/* 서비스 목록을 순회해 동일한 스타일의 아이콘 버튼을 생성. */}
        {headerActions.filter(({ requiresAdmin }) => !requiresAdmin || role === "ADMIN").map(({ label, icon: Icon }) => {
          // 구현된 서비스는 화면과 무관하게 공통 경로로 이동.
          const onClick = label === "홈"
            ? onHomeAction
            : label === "메시지"
              ? () => isAuthenticated ? router.push("/message") : onServiceAction(label)
              : label === "주소록" || label === "조직도"
                ? () => isAuthenticated ? router.push("/addressBook") : onServiceAction(label)
                : label === "내 프로필"
                  ? onProfileAction
                  : () => onServiceAction(label);

          return (
            <span
              key={label}
              ref={label === "내 프로필" ? profileMenuRef : undefined}
              className="group relative"
            >
              <button
                type="button"
                aria-label={label}
                onClick={onClick}
                className={`flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-300 transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${label === "내 프로필" && isAuthenticated ? "min-w-9 px-0.5" : "w-9"}`}
              >
                {label === "내 프로필" && isAuthenticated ? (
                  // 사진 업로드 전에는 이름 길이에 맞는 기본 아바타를 사용.
                  <span className="flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-0 text-[11px] font-bold tracking-[-0.1em] leading-none text-slate-900 shadow-sm">
                    {profileAvatarText}
                  </span>
                ) : (
                  <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                )}
              </button>
              {!(label === "내 프로필" && isProfileMenuOpen) && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-11 z-[70] hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-700 px-2 py-1 text-[11px] font-medium text-white shadow-md sm:group-hover:block"
                >
                  {label}
                </span>
              )}
              {label === "내 프로필" && isProfileMenuOpen && onLogout && (
                <div className="absolute right-0 top-11 z-[60] w-44 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-800 shadow-lg">
                  {/* 로그인 API에서 받은 사용자 이름과 역할을 표시. */}
                  <p className="px-3 py-2 text-xs text-slate-500">{profileLabel}</p>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
