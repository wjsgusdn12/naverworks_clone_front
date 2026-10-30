// 대화상자 위치.
// - center: 화면 가운데(기본).
// - beside-profile: 상단바 프로필 패널에서 연 대화상자. 패널 왼쪽에 위쪽 줄을 맞춰 붙여서
//   방금 누른 메뉴 바로 옆에 뜨게 함(패널 폭 400 + 오른쪽 여백 12 + 간격 12 = 424).
//   화면이 좁아 옆자리가 없으면 패널 자리(오른쪽 위)에 겹쳐 띄움.
export type DialogPlacement = "center" | "beside-profile";

// 바깥(투명) 영역: 누르면 닫히는 전체 화면 층. 배경은 어둡게 하지 않음.
export const dialogOverlayClass = (placement: DialogPlacement) =>
  placement === "beside-profile"
    ? "fixed inset-0 z-[100] flex items-start justify-end p-3 pt-[60px] min-[880px]:pr-[424px]"
    : "fixed inset-0 z-[100] flex items-center justify-center p-4";

// 카드에 덧붙일 클래스: 옆에 붙을 때는 화면 높이를 넘지 않게 하고 옆에서 미끄러져 나오게 함.
export const dialogCardClass = (placement: DialogPlacement) =>
  placement === "beside-profile"
    ? "max-h-[calc(100vh-76px)] overflow-y-auto animate-in fade-in slide-in-from-right-2"
    : "";
