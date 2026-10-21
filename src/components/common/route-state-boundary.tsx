"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// 경로가 바뀌면 화면 하위 트리를 새로 만들어 이전 모달·검색·선택 상태를 남기지 않음.
export function RouteStateBoundary({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  return <div key={pathname}>{children}</div>;
}
