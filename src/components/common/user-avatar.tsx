"use client";

import { X } from "lucide-react";
import type { PresenceStatus } from "@/lib/api/address-book-api";
import { memberStatusOption, type MemberStatusType } from "@/lib/status-options";

// 프로젝트 공통 사용자 프로필 아바타. 이름 앞 세 글자 + 오른쪽 아래 상태 배지.
// 배지는 상태 설정(바쁨·휴가 등)이 있으면 그 아이콘, 없으면 접속 점(온라인 초록 / 오프라인 회색).
// 주소록·메시지·상단바 프로필 패널이 모두 이 컴포넌트를 씀.
export type UserAvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClassName: Record<UserAvatarSize, { box: string; badge: string; icon: number }> = {
  sm: { box: "h-8 w-8 text-[10px]", badge: "h-3.5 w-3.5", icon: 9 },
  md: { box: "h-10 w-10 text-xs", badge: "h-4 w-4", icon: 10 },
  lg: { box: "h-16 w-16 text-lg", badge: "h-5 w-5", icon: 12 },
  // 메시지 화면 프로필 모달처럼 크게 보여 줄 때.
  xl: { box: "h-24 w-24 text-2xl", badge: "-bottom-1 -right-1 h-6 w-6", icon: 14 },
};

const presenceClassName: Record<PresenceStatus, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-slate-300",
  INACTIVE: "bg-red-500 text-white",
};

type UserAvatarProps = {
  name: string;
  presenceStatus: PresenceStatus;
  // 구성원이 고른 상태. 있으면 접속 점 대신 그 아이콘을 배지로 그림.
  statusType?: MemberStatusType | null;
  size?: UserAvatarSize;
  // 있으면 눌러서 프로필을 여는 버튼처럼 동작.
  onClick?: () => void;
  className?: string;
  // 메시지 화면에서 아바타를 찾을 때 쓰는 표식.
  dataName?: string;
};

export function UserAvatar({
  name,
  presenceStatus,
  statusType = null,
  size = "sm",
  onClick,
  className = "",
  dataName,
}: UserAvatarProps) {
  const sizes = sizeClassName[size];
  // 비활성 계정은 상태 설정과 무관하게 비활성 배지.
  const status = presenceStatus === "INACTIVE" ? null : memberStatusOption(statusType);
  const StatusIcon = status?.icon;
  const openProfile = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onClick) return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <span
      data-message-profile-name={dataName}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${name} 프로필 보기` : undefined}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-800 ${sizes.box} ${onClick ? "cursor-pointer transition hover:border-blue-400 hover:shadow-sm active:scale-95" : ""} ${className}`}
    >
      <span className="whitespace-nowrap">{name.slice(0, 3)}</span>
      <span
        title={status?.label}
        className={`absolute inline-flex items-center justify-center rounded-full ring-2 ring-white ${size === "xl" ? "" : "-bottom-0.5 -right-0.5"} ${sizes.badge} ${status ? status.className : presenceClassName[presenceStatus]}`}
      >
        {StatusIcon ? (
          <StatusIcon size={sizes.icon} strokeWidth={3} aria-hidden="true" />
        ) : (
          presenceStatus === "INACTIVE" && (
            <X size={sizes.icon} strokeWidth={3} aria-hidden="true" />
          )
        )}
      </span>
    </span>
  );
}
