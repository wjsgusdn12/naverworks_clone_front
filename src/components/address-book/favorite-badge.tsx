// 즐겨찾기 표시 딱지. 이름 옆에 붙이는 작은 녹색 원 안의 별.
// 아이콘 세트의 별은 무게중심이 위로 치우쳐 보여서, 원 중심에 맞춘 별 도형을 직접 그림.
export function FavoriteBadge() {
  return (
    <span
      aria-label="즐겨찾기"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
    >
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden="true">
        <polygon
          fill="currentColor"
          points="12,3 14.47,9.6 21.51,9.91 15.99,14.3 17.88,21.09 12,17.2 6.12,21.09 8.01,14.3 2.49,9.91 9.53,9.6"
        />
      </svg>
    </span>
  );
}
