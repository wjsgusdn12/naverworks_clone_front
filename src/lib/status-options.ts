import { Briefcase, Clock, Minus, Moon, Plane, Plus, X, type LucideIcon } from "lucide-react";

// 구성원이 직접 고르는 상태(바쁨·휴가 등). 접속 상태(온라인/오프라인)와 별개로 아바타 배지에 그림.
// 서버 enum MemberStatusType과 값이 같아야 함.
export type MemberStatusType =
  "BUSY" | "AWAY" | "OFF_WORK" | "ABSENT" | "VACATION" | "BUSINESS_TRIP" | "SICK_LEAVE";

export type MemberStatusOption = {
  type: MemberStatusType;
  label: string;
  icon: LucideIcon;
  // 배지 배경·글자색. 아이콘은 흰색.
  className: string;
};

export const memberStatusOptions: MemberStatusOption[] = [
  { type: "BUSY", label: "바쁨", icon: Minus, className: "bg-red-500 text-white" },
  { type: "AWAY", label: "자리 비움", icon: Clock, className: "bg-amber-400 text-white" },
  { type: "OFF_WORK", label: "퇴근", icon: Moon, className: "bg-slate-500 text-white" },
  { type: "ABSENT", label: "부재", icon: X, className: "bg-slate-400 text-white" },
  { type: "VACATION", label: "휴가", icon: Plane, className: "bg-violet-500 text-white" },
  { type: "BUSINESS_TRIP", label: "출장", icon: Briefcase, className: "bg-teal-500 text-white" },
  { type: "SICK_LEAVE", label: "병가", icon: Plus, className: "bg-teal-600 text-white" },
];

export const memberStatusOption = (type: MemberStatusType | null | undefined) =>
  type ? (memberStatusOptions.find((option) => option.type === type) ?? null) : null;

// 자동 해제 시각을 "10월 30일 09:00까지"로.
export const formatStatusUntil = (value: string) => {
  const date = new Date(value);
  return `${date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지`;
};

// 상태 + 해제 시각을 한 줄로. 예) "휴가 · 10월 30일 09:00까지"
export const formatMemberStatus = (type: MemberStatusType | null, until: string | null) => {
  const option = memberStatusOption(type);
  if (!option) return null;
  return until ? `${option.label} · ${formatStatusUntil(until)}` : option.label;
};
