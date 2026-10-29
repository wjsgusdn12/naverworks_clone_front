// 메시지 입력창 높이는 사용자가 손잡이로 조절할 때만 바뀌고, 내용이 넘치면 입력창 안에서 스크롤.
export const DEFAULT_INPUT_HEIGHT = 144;
export const MIN_INPUT_HEIGHT = 96;
export const MAX_INPUT_HEIGHT = 400;
export const clampInputHeight = (height: number) =>
  Math.round(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, height)));
// 같은 브라우저를 여러 계정이 써도 섞이지 않게 계정(membershipId)별 키로 저장.
export const inputHeightStorageKey = (membershipId: number) =>
  `naverworks:messageInputHeight:${membershipId}`;
export const readStoredInputHeight = (membershipId: number | undefined) => {
  if (typeof window === "undefined" || membershipId === undefined) return DEFAULT_INPUT_HEIGHT;
  try {
    const saved = Number(window.localStorage.getItem(inputHeightStorageKey(membershipId)));
    return saved ? clampInputHeight(saved) : DEFAULT_INPUT_HEIGHT;
  } catch {
    return DEFAULT_INPUT_HEIGHT;
  }
};
