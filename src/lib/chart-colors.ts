// 프로젝트 공통 그래프 색. 그래프를 그릴 때 색을 직접 적지 말고 여기 값을 씀(색을 바꿀 때 한 곳만 고치면 됨).
// 계열 색은 색약 구분·대비 검사(dataviz validate_palette)를 통과한 조합.
export const CHART_COLORS = {
  // 계열 색: 첫째 계열(요청 수·평균 응답)은 파랑, 둘째 계열(오류·p95)은 주황 + 점선
  primary: "#3b82f6",
  secondary: "#d97706",
  // 빠르기(좋음↔나쁨): 빠를수록 진한 파랑, 느릴수록 진한 빨강
  speed: {
    fast: "#184f95",
    normal: "#6da7ec",
    slow: "#f08c8b",
    verySlow: "#b42c2c",
  },
  // 그래프 틀: 가로 눈금선·기준선, 마우스 위치 세로선, 점 테두리(바탕색)
  grid: "#e2e8f0",
  crosshair: "#94a3b8",
  surface: "#ffffff",
} as const;
