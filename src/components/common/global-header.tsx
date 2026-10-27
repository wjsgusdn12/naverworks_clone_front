"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
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
  const { sessionExpiresAt } = useAuth();
  const {
    notificationCount,
    notifications,
    notificationEnabled,
    notificationMode,
    acknowledgeNotifications,
    markNotificationRead,
    setNotificationMode,
  } = useChatNotification();
  const [now, setNow] = useState(0);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isNotificationModeOpen, setIsNotificationModeOpen] = useState(false);
  // 공통 헤더의 서비스 이동은 어느 화면에서나 같은 경로를 사용.
  const router = useRouter();
  // 프로필 버튼과 메뉴 영역을 함께 참조해 바깥 클릭을 판별.
  const profileMenuRef = useRef<HTMLSpanElement>(null);
  const notificationPanelRef = useRef<HTMLSpanElement>(null);
  // 한글·영문·이모지 모두 글자 단위가 깨지지 않도록 앞 세 글자만 사용.
  const profileAvatarText = Array.from(profileName).slice(0, 3).join("") || "사용자";
  const sessionRemainingSeconds = sessionExpiresAt && now > 0
    ? Math.max(0, Math.floor((new Date(sessionExpiresAt).getTime() - now) / 1000))
    : null;
  const sessionRemainingText = sessionRemainingSeconds === null ? null : `${String(Math.floor(sessionRemainingSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((sessionRemainingSeconds % 3600) / 60)).padStart(2, "0")}:${String(sessionRemainingSeconds % 60).padStart(2, "0")}`;
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const updateNow = () => setNow(Date.now());
    const initialTimer = window.setTimeout(updateNow, 0);
    const timer = window.setInterval(updateNow, 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [sessionExpiresAt]);

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

  useEffect(() => {
    if (!isNotificationPanelOpen) return;
    const closeNotificationPanel = (event: MouseEvent) => {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNotificationPanelOpen(false);
    };
    document.addEventListener("mousedown", closeNotificationPanel);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeNotificationPanel);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isNotificationPanelOpen]);

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
        {isAuthenticated && sessionRemainingText && <span className="mr-2 hidden whitespace-nowrap text-[11px] text-zinc-400 lg:inline">세션 {sessionRemainingText}</span>}
        {/* 서비스 목록을 순회해 동일한 스타일의 아이콘 버튼을 생성. */}
        {headerActions.filter(({ requiresAdmin }) => !requiresAdmin || role === "ADMIN").map(({ label, icon: Icon }) => {
          // 구현된 서비스는 화면과 무관하게 공통 경로로 이동.
          const onClick = label === "홈"
            ? onHomeAction
            : label === "메시지"
              ? () => isAuthenticated ? router.push("/message") : onServiceAction(label)
            : label === "주소록" || label === "조직도"
                ? () => isAuthenticated ? router.push("/addressBook") : onServiceAction(label)
                : label === "알림"
                  ? () => setIsNotificationPanelOpen((current) => !current)
                : label === "내 프로필"
                  ? onProfileAction
                  : () => onServiceAction(label);

          return (
            <span
              key={label}
              ref={label === "내 프로필" ? profileMenuRef : label === "알림" ? notificationPanelRef : undefined}
              className="group relative"
            >
              <button
                type="button"
                aria-label={label === "알림" && notificationCount > 0 ? `알림 ${notificationCount}개` : label}
                aria-expanded={label === "알림" ? isNotificationPanelOpen : label === "내 프로필" ? isProfileMenuOpen : undefined}
                aria-haspopup={label === "알림" || label === "내 프로필" ? "menu" : undefined}
                onClick={onClick}
                className={`flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-300 transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${label === "내 프로필" && isAuthenticated ? "min-w-9 px-0.5" : "w-9"}`}
              >
                {label === "내 프로필" && isAuthenticated ? (
                  // 사진 업로드 전에는 이름 길이에 맞는 기본 아바타를 사용.
                  <span className="relative flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-0 text-[11px] font-bold tracking-[-0.1em] leading-none text-slate-900 shadow-sm">
                    {profileAvatarText}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                  </span>
                ) : label === "알림" ? (
                  <span className="relative">
                    <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    {notificationCount > 0 && (
                      <span aria-atomic="true" aria-live="polite" className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-zinc-950">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </span>
                ) : (
                  <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                )}
              </button>
              {!(label === "내 프로필" && isProfileMenuOpen) && !(label === "알림" && isNotificationPanelOpen) && (
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
              {label === "알림" && isNotificationPanelOpen && (
                <section className="absolute right-0 top-11 z-[60] w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <strong className="text-sm">알림</strong>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={acknowledgeNotifications}
                        className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                      >
                        모두 읽음
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsNotificationModeOpen((current) => !current)}
                          className={`cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition ${notificationEnabled ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >
                          알림 {notificationMode === "ALL" ? "ON" : notificationMode === "MENTION" ? "멘션" : "OFF"}
                        </button>
                        {isNotificationModeOpen && (
                          <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                            {([ ["ALL", "모든 메시지 알림"], ["MENTION", "내가 멘션된 메시지만"], ["NONE", "알림 받지 않기"] ] as const).map(([mode, label]) => (
                              <button key={mode} type="button" onClick={() => { setNotificationMode(mode); setIsNotificationModeOpen(false); }} className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${notificationMode === mode ? "bg-blue-50 text-blue-600" : "text-slate-700"}`}>{label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-slate-400">새 알림이 없습니다.</p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(notification.id);
                            setIsNotificationPanelOpen(false);
                            router.push(`/message?roomId=${notification.chatRoomId}`);
                          }}
                          className={`block w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-100 ${notification.read ? "bg-white" : "bg-blue-50/70"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <strong className="truncate text-sm">{notification.mentioned && <span className="mr-1 text-blue-600">@</span>}{notification.roomName}</strong>
                            <time className="shrink-0 text-[11px] text-slate-400">
                              {new Date(notification.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                            </time>
                          </div>
                          <p className="mt-1 truncate text-xs font-medium text-slate-600">{notification.senderName}</p>
                          <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-500">{notification.content}</p>
                        </button>
                      ))
                    )}
                  </div>
                </section>
              )}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
