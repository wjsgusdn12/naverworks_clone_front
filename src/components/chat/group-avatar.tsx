import { UsersRound } from "lucide-react";

// 그룹 채팅방 기본 프로필. 이름 앞 세 글자를 어두운 원에 쓰고 우하단에 그룹 배지를 항상 표시.
// 메시지 화면과 주소록 그룹 화면이 같은 모양을 쓰도록 공통 컴포넌트로 둠.
export function GroupAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  const isExtraLarge = size === "xl";
  const sizeClass = isExtraLarge ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white ${sizeClass}`}
    >
      <span>{name.slice(0, 3)}</span>
      <span
        className={`absolute flex items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white ${isExtraLarge ? "-bottom-0.5 -right-0.5 h-6 w-6" : "-bottom-1 -right-1 h-4 w-4"}`}
      >
        <UsersRound size={isExtraLarge ? 14 : 10} strokeWidth={3} />
      </span>
    </span>
  );
}
