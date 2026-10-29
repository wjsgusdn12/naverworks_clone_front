"use client";

import type { ReactNode } from "react";

export function SidebarIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex w-full cursor-pointer flex-col items-center gap-1 rounded-md py-2 text-xs text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
