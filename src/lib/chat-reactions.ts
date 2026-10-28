// 빠른 선택 바에 보여 주는 이모지. 서버에는 code로 저장하고 화면에서만 char로 바꿔 그림.
// (나중에 이미지 이모지로 바꾸더라도 저장된 값은 그대로 쓸 수 있음.)
export const REACTION_EMOJIS = [
  { code: "thumbs_up", char: "👍", label: "좋아요" },
  { code: "heart", char: "❤️", label: "하트" },
  { code: "laugh", char: "😂", label: "웃음" },
  { code: "wow", char: "😮", label: "놀람" },
  { code: "sad", char: "😢", label: "슬픔" },
  { code: "pray", char: "🙏", label: "감사" },
] as const;

export type ReactionCode = (typeof REACTION_EMOJIS)[number]["code"];

// 모르는 코드가 와도 화면이 깨지지 않게 코드 문자열을 그대로 보여 줌.
export const reactionChar = (code: string) =>
  REACTION_EMOJIS.find((item) => item.code === code)?.char ?? code;
export const reactionLabel = (code: string) =>
  REACTION_EMOJIS.find((item) => item.code === code)?.label ?? code;
