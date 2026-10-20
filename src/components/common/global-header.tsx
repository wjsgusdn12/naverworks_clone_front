"use client";

import {
  Bell,
  BookUser,
  Building2,
  CalendarDays,
  Grid2X2,
  Home,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type HeaderAction = {
  label: string;
  icon: LucideIcon;
};

const headerActions: HeaderAction[] = [
  { label: "홈", icon: Home },
  { label: "메신저", icon: MessageCircle },
  { label: "캘린더", icon: CalendarDays },
  { label: "주소록", icon: BookUser },
  { label: "관리자", icon: ShieldCheck },
  { label: "전체 서비스", icon: Grid2X2 },
  { label: "알림", icon: Bell },
  { label: "조직도", icon: Building2 },
  { label: "설정", icon: Settings },
  { label: "내 프로필", icon: UserRound },
];

type GlobalHeaderProps = {
  onProtectedAction: () => void;
};

export function GlobalHeader({ onProtectedAction }: GlobalHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-6 bg-zinc-950 px-5 text-white shadow-sm sm:px-8">
      <div className="flex min-w-fit items-center gap-8">
        <button
          type="button"
          aria-label="홈으로 이동"
          className="text-left"
          onClick={onProtectedAction}
        >
          <span className="block text-xs font-bold tracking-[0.16em]">NAVER WORKS</span>
          <span className="block text-[8px] tracking-[0.28em] text-zinc-400">COLLABORATION</span>
        </button>
        <button
          type="button"
          className="text-lg font-semibold"
          onClick={onProtectedAction}
        >
          홈
        </button>
      </div>

      <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="주요 서비스">
        {headerActions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={onProtectedAction}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ))}
      </nav>
    </header>
  );
}
