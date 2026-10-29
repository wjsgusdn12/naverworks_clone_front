"use client";

import type { PresenceStatus } from "@/lib/api/address-book-api";
import { X } from "lucide-react";

export function MessageMemberAvatar({
  name,
  presenceStatus,
  size = "md",
  onClick,
}: {
  name: string;
  presenceStatus: PresenceStatus;
  size?: "md" | "lg";
  onClick?: () => void;
}) {
  const isLarge = size === "lg";
  const badgeClassName = {
    ONLINE: "bg-emerald-500",
    OFFLINE: "bg-slate-300",
    AWAY: "bg-slate-500 text-white",
    INACTIVE: "bg-red-500 text-white",
  }[presenceStatus];
  // 개인 프로필은 어느 메시지 화면에서도 상태 배지를 빠뜨리지 않음.
  const openProfile = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onClick) return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <span
      data-message-profile-name={name}
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
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-800 ${onClick ? "cursor-pointer transition hover:border-blue-400 hover:shadow-sm active:scale-95" : ""} ${isLarge ? "h-10 w-10 text-xs" : "h-10 w-10 text-xs"}`}
    >
      <span className="whitespace-nowrap">{name.slice(0, 3)}</span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-white ${isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} ${badgeClassName}`}
      >
        {(presenceStatus === "AWAY" || presenceStatus === "INACTIVE") && (
          <X size={isLarge ? 10 : 9} strokeWidth={3} />
        )}
      </span>
    </span>
  );
}
