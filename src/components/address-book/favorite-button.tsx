import { Star } from "lucide-react";

type FavoriteButtonProps = {
  active: boolean;
  onClick: () => void;
  size?: "list" | "panel";
};

// 목록과 상세 패널의 즐겨찾기 상태 표현을 한 디자인으로 유지.
export function FavoriteButton({ active, onClick, size = "list" }: FavoriteButtonProps) {
  const isPanelButton = size === "panel";

  return <button
    type="button"
    aria-label="즐겨찾기 변경"
    className={`flex cursor-pointer items-center justify-center rounded-full border transition active:scale-90 ${isPanelButton ? "h-6 w-6" : "h-5 w-5"} ${active ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-slate-500 bg-transparent text-slate-500 hover:bg-slate-100"}`}
    onClick={onClick}
  >
    <Star size={isPanelButton ? 13 : 12} fill={active ? "currentColor" : "none"} />
  </button>;
}
