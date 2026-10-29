import type { ChatGroupSummary } from "@/lib/api/chat-api";

// 구성원 목록 한 페이지 크기.
export const MEMBER_PAGE_SIZE = 20;

// 그룹 탭: 회사의 그룹 채팅방을 "전체 · 내가 속한 그룹 · 내가 마스터인 그룹"으로 나눠 보여 줌. 기본은 내가 속한 그룹.
export type GroupTab = "all" | "joined" | "owner";
export const groupTabs: { key: GroupTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "joined", label: "내가 속한 그룹" },
  { key: "owner", label: "내가 마스터인 그룹" },
];

export type GroupSortKey = "name" | "memberCount" | "lastMessageAt" | "createdAt";
export const groupColumns: [GroupSortKey, string][] = [
  ["name", "그룹명"],
  ["memberCount", "멤버수"],
  ["lastMessageAt", "마지막 대화"],
  ["createdAt", "그룹 생성일"],
];

// 정렬 비교. 날짜는 문자열(ISO) 비교로 충분하고, 대화가 없는 방은 가장 뒤로 보냄.
export const compareGroups = (a: ChatGroupSummary, b: ChatGroupSummary, key: GroupSortKey) => {
  if (key === "name") return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  if (key === "memberCount") return a.memberCount - b.memberCount;
  const left = a[key] ?? "";
  const right = b[key] ?? "";
  return left < right ? -1 : left > right ? 1 : 0;
};

export const filterGroups = (groups: ChatGroupSummary[], tab: GroupTab) =>
  groups.filter((group) => (tab === "all" ? true : tab === "joined" ? group.joined : group.owner));

// 2024.11.14 형식.
export const formatDate = (value: string) => {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
};

export const formatGroupDate = (value: string | null) => {
  if (!value) return "대화 없음";
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};
