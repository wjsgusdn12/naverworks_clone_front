"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  BookUser,
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
import type { NotificationCategory, NotificationItem } from "@/lib/api/notification-api";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { Tooltip } from "@/components/common/tooltip";
import { LoadingState } from "@/components/common/loading";
import { ProjectGuideModal } from "@/components/common/project-guide-modal";
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
  { label: "설정", icon: Settings },
  { label: "내 프로필", icon: UserRound },
  // 두 저장소 README 다이어그램을 보여 주는 소개 모달.
  { label: "프로젝트 소개", icon: BookOpen },
];

// 알림 패널 칩 목록. 아직 기능이 없는 서비스(캘린더 등)는 칩을 만들지 않음.
const notificationChips: { key: "ALL" | NotificationCategory; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "MESSAGE", label: "메시지" },
  { key: "ADDRESS_BOOK", label: "주소록" },
  { key: "SYSTEM", label: "시스템" },
];

// 분류별 카드 상단에 붙는 아이콘·이름.
const notificationCategoryMeta: Record<
  NotificationCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  MESSAGE: { label: "메시지 알림", icon: MessageCircle, className: "bg-blue-50 text-blue-600" },
  ADDRESS_BOOK: {
    label: "주소록 알림",
    icon: BookUser,
    className: "bg-emerald-50 text-emerald-600",
  },
  SYSTEM: { label: "로그인 알림", icon: ShieldCheck, className: "bg-violet-50 text-violet-600" },
};

// 카드 우측 날짜: 오늘이면 시각, 아니면 "10월 20일".
const formatNotificationDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ko-KR", { month: "long", day: "2-digit" });
};

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
    notificationsLoaded,
    notificationEnabled,
    notificationMode,
    acknowledgeNotifications,
    markNotificationRead,
    setNotificationMode,
  } = useChatNotification();
  const [now, setNow] = useState(0);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isNotificationModeOpen, setIsNotificationModeOpen] = useState(false);
  const [isProjectGuideOpen, setIsProjectGuideOpen] = useState(false);
  // 알림 패널 상단 칩. "ALL"은 서버 분류와 무관하게 전체를 뜻함.
  const [notificationFilter, setNotificationFilter] = useState<"ALL" | NotificationCategory>("ALL");
  const visibleNotifications =
    notificationFilter === "ALL"
      ? notifications
      : notifications.filter((item) => item.category === notificationFilter);
  // 공통 헤더의 서비스 이동은 어느 화면에서나 같은 경로를 사용.
  const router = useRouter();
  // 프로필 버튼과 메뉴 영역을 함께 참조해 바깥 클릭을 판별.
  const profileMenuRef = useRef<HTMLSpanElement>(null);
  const notificationPanelRef = useRef<HTMLSpanElement>(null);
  // 알림 설정 드롭다운(버튼 + 목록) 영역. 바깥 클릭 판별용.
  const notificationModeRef = useRef<HTMLDivElement>(null);
  // 한글·영문·이모지 모두 글자 단위가 깨지지 않도록 앞 세 글자만 사용.
  const profileAvatarText = Array.from(profileName).slice(0, 3).join("") || "사용자";
  const sessionRemainingSeconds =
    sessionExpiresAt && now > 0
      ? Math.max(0, Math.floor((new Date(sessionExpiresAt).getTime() - now) / 1000))
      : null;
  const sessionRemainingText =
    sessionRemainingSeconds === null
      ? null
      : `${String(Math.floor(sessionRemainingSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((sessionRemainingSeconds % 3600) / 60)).padStart(2, "0")}:${String(sessionRemainingSeconds % 60).padStart(2, "0")}`;
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

  // 알림 설정 드롭다운: 바깥 클릭·Esc로 닫음. 알림 패널 안을 눌러도 드롭다운 밖이면 닫힘.
  useEffect(() => {
    if (!isNotificationModeOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!notificationModeRef.current?.contains(event.target as Node)) {
        setIsNotificationModeOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNotificationModeOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isNotificationModeOpen]);

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-6 bg-zinc-950 px-3 text-white shadow-sm sm:px-4">
      <div className="flex min-w-fit items-center gap-8">
        {onSidebarToggle && (
          <button
            type="button"
            aria-label={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-transparent text-white transition duration-200 hover:scale-105 hover:bg-zinc-800 active:scale-95"
            onClick={onSidebarToggle}
          >
            <Menu size={21} />
          </button>
        )}
        <button
          type="button"
          aria-label="홈으로 이동"
          className="cursor-pointer rounded-md text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={onHomeAction}
        >
          <span className="block text-xs font-bold tracking-[0.16em]">NAVER WORKS</span>
          <span className="block text-[8px] tracking-[0.28em] text-zinc-400">COLLABORATION</span>
        </button>
        <span className="text-lg font-semibold">{pageTitle}</span>
      </div>

      {headerContent && <div className="min-w-0 flex-1">{headerContent}</div>}

      <nav
        className="flex min-w-0 items-center gap-1 overflow-x-auto sm:overflow-visible"
        aria-label="주요 서비스"
      >
        {isAuthenticated && sessionRemainingText && (
          <span className="mr-2 hidden whitespace-nowrap text-[11px] text-zinc-400 lg:inline">
            세션 {sessionRemainingText}
          </span>
        )}
        {/* 서비스 목록을 순회해 동일한 스타일의 아이콘 버튼을 생성. */}
        {headerActions
          .filter(({ requiresAdmin }) => !requiresAdmin || role === "ADMIN")
          .map(({ label, icon: Icon }) => {
            // 구현된 서비스는 화면과 무관하게 공통 경로로 이동.
            const onClick =
              label === "홈"
                ? onHomeAction
                : label === "메시지"
                  ? () => (isAuthenticated ? router.push("/message") : onServiceAction(label))
                  : label === "주소록"
                    ? () => (isAuthenticated ? router.push("/addressBook") : onServiceAction(label))
                    : label === "알림"
                      ? () => setIsNotificationPanelOpen((current) => !current)
                      : label === "내 프로필"
                        ? onProfileAction
                        : label === "프로젝트 소개"
                          ? () => setIsProjectGuideOpen(true)
                          : () => onServiceAction(label);

            return (
              <span
                key={label}
                ref={
                  label === "내 프로필"
                    ? profileMenuRef
                    : label === "알림"
                      ? notificationPanelRef
                      : undefined
                }
                className="relative"
              >
                {/* 메뉴·패널이 열려 있는 동안은 툴팁이 겹치지 않도록 끔. */}
                <Tooltip
                  label={label}
                  disabled={
                    (label === "내 프로필" && isProfileMenuOpen) ||
                    (label === "알림" && isNotificationPanelOpen)
                  }
                >
                  <button
                    type="button"
                    aria-label={
                      label === "알림" && notificationCount > 0
                        ? `알림 ${notificationCount}개`
                        : label
                    }
                    aria-expanded={
                      label === "알림"
                        ? isNotificationPanelOpen
                        : label === "내 프로필"
                          ? isProfileMenuOpen
                          : undefined
                    }
                    aria-haspopup={label === "알림" || label === "내 프로필" ? "menu" : undefined}
                    onClick={onClick}
                    className={`flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-300 transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${label === "내 프로필" && isAuthenticated ? "min-w-9 px-0.5" : label === "프로젝트 소개" ? "w-9 hover:scale-110 hover:bg-transparent" : "w-9"}`}
                  >
                    {label === "내 프로필" && isAuthenticated ? (
                      // 사진 업로드 전에는 이름 길이에 맞는 기본 아바타를 사용.
                      <span className="relative flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-0 text-[11px] font-bold tracking-[-0.1em] leading-none text-slate-900 shadow-sm">
                        {profileAvatarText}
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                      </span>
                    ) : label === "프로젝트 소개" ? (
                      // 무지개 테두리가 돌고 빛이 지나가는 배지. 안쪽은 어두운 원이라 아이콘이 또렷하게 보임.
                      <span className="project-guide-badge flex h-8 w-8 items-center justify-center">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-amber-300">
                          <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
                        </span>
                      </span>
                    ) : label === "알림" ? (
                      <span className="relative">
                        <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                        {notificationCount > 0 && (
                          <span
                            aria-atomic="true"
                            aria-live="polite"
                            className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-zinc-950"
                          >
                            {notificationCount > 99 ? "99+" : notificationCount}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    )}
                  </button>
                </Tooltip>
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
                  // 네이버웍스처럼 화면 오른쪽 끝에 붙는 세로로 긴 패널. 종 아이콘 위치와 무관하게 fixed로 고정하고 내부만 스크롤.
                  <section className="fixed right-3 top-[60px] z-[60] flex h-[min(720px,calc(100vh-76px))] w-[400px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
                    <div className="flex items-center justify-between px-5 pb-2 pt-4">
                      <strong className="text-lg">서비스 알림</strong>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={acknowledgeNotifications}
                          disabled={notificationCount === 0}
                          className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
                        >
                          모두 읽음
                        </button>
                        <div ref={notificationModeRef} className="relative">
                          {/* 메시지 알림 수신 범위(전체·멘션만·끔) 설정. */}
                          <button
                            type="button"
                            aria-label="알림 설정"
                            aria-expanded={isNotificationModeOpen}
                            onClick={() => setIsNotificationModeOpen((current) => !current)}
                            className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition hover:bg-slate-100 ${notificationEnabled ? "text-slate-700" : "text-slate-400"}`}
                          >
                            <Bell size={18} aria-hidden="true" />
                            <span
                              className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${notificationMode === "ALL" ? "bg-blue-500" : notificationMode === "MENTION" ? "bg-amber-500" : "bg-slate-300"}`}
                            />
                          </button>
                          {isNotificationModeOpen && (
                            <div className="absolute right-0 top-9 z-10 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-slate-400">
                                메시지 알림 받기
                              </p>
                              {(
                                [
                                  ["ALL", "모든 메시지"],
                                  ["MENTION", "내가 멘션된 메시지만"],
                                  ["NONE", "받지 않기"],
                                ] as const
                              ).map(([mode, modeLabel]) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => {
                                    setNotificationMode(mode);
                                    setIsNotificationModeOpen(false);
                                  }}
                                  className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${notificationMode === mode ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-700"}`}
                                >
                                  {modeLabel}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 분류 칩. 고른 칩만 파란색으로 강조. */}
                    <div className="flex flex-wrap gap-2 px-5 pb-3 pt-1">
                      {notificationChips.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          aria-pressed={notificationFilter === chip.key}
                          onClick={() => setNotificationFilter(chip.key)}
                          className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${notificationFilter === chip.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-3">
                      {!notificationsLoaded ? (
                        <LoadingState message="알림을 불러오는 중입니다..." className="h-full" />
                      ) : visibleNotifications.length === 0 ? (
                        <p className="flex h-full items-center justify-center text-sm text-slate-400">
                          최근 30일간 받은 알림이 없습니다.
                        </p>
                      ) : (
                        <>
                          {visibleNotifications.map((notification: NotificationItem) => {
                            const meta = notificationCategoryMeta[notification.category];
                            const CategoryIcon = meta.icon;
                            return (
                              <button
                                key={notification.id}
                                type="button"
                                onClick={() => {
                                  markNotificationRead(notification.id);
                                  // 이동할 곳이 없는 알림(로그인 알림 등)은 읽음 처리만 함.
                                  if (!notification.linkPath) return;
                                  setIsNotificationPanelOpen(false);
                                  router.push(notification.linkPath);
                                }}
                                className={`mb-2.5 block w-full cursor-pointer rounded-xl border bg-white px-4 py-3.5 text-left transition hover:border-blue-100 ${notification.read ? "border-slate-100" : "border-blue-100"}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.className}`}
                                    >
                                      <CategoryIcon size={14} aria-hidden="true" />
                                    </span>
                                    <span className="truncate text-xs font-medium text-slate-500">
                                      {meta.label}
                                    </span>
                                    {!notification.read && (
                                      <span
                                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                                        aria-label="안 읽음"
                                      />
                                    )}
                                  </span>
                                  <time className="shrink-0 text-xs text-slate-400">
                                    {formatNotificationDate(notification.createdAt)}
                                  </time>
                                </div>
                                <p className="mt-2 truncate text-[15px] font-semibold text-slate-900">
                                  {notification.title}
                                </p>
                                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-500">
                                  {notification.body}
                                </p>
                              </button>
                            );
                          })}
                          <p className="py-6 text-center text-sm text-slate-400">
                            최근 30일간 받은 알림을 모두 확인했습니다.
                          </p>
                        </>
                      )}
                    </div>
                  </section>
                )}
              </span>
            );
          })}
      </nav>
      {isProjectGuideOpen && <ProjectGuideModal onClose={() => setIsProjectGuideOpen(false)} />}
    </header>
  );
}
