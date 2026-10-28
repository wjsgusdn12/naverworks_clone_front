// 메시지 본문을 화면에 그릴 때 쓰는 토큰 분리. 저장된 본문은 그대로 두고 표시만 바꿈.
// url: 새 탭 링크, mention: 파란 강조, text: 그대로.
export type MessageToken =
  | { type: "text"; value: string }
  | { type: "mention"; value: string }
  | { type: "url"; value: string; href: string };

// http(s)://… 또는 www.… 로 시작하고 공백·꺾쇠·따옴표 전까지를 URL로 봄.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/giu;
const MENTION_PATTERN = /(@(?:All|[\p{L}\p{N}_-]+))/gu;
const MENTION_EXACT = /^@(?:All|[\p{L}\p{N}_-]+)$/u;
// 문장 끝에 붙은 구두점·닫는 괄호는 URL에 포함하지 않음. 여는 괄호가 URL 안에 있으면 짝이 맞는 닫는 괄호는 유지.
const TRAILING_PUNCTUATION = /[.,;:!?'"»”’)\]}]+$/u;

const trimTrailing = (raw: string) => {
  let url = raw;
  for (;;) {
    const trimmed = url.replace(TRAILING_PUNCTUATION, "");
    if (trimmed === url) return url;
    // ")"가 잘렸는데 URL 안에 짝이 되는 "("가 있으면 되돌림(위키 링크 같은 경우).
    const removed = url.slice(trimmed.length);
    if (
      removed.startsWith(")") &&
      (trimmed.match(/\(/g)?.length ?? 0) > (trimmed.match(/\)/g)?.length ?? 0)
    ) {
      return trimmed + ")";
    }
    url = trimmed;
  }
};

const splitMentions = (text: string): MessageToken[] =>
  text
    .split(MENTION_PATTERN)
    .filter((part) => part !== "")
    .map((part) =>
      // split용 정규식은 g 플래그라 test()에 쓰면 lastIndex가 남아 번갈아 실패하므로 별도 검사식 사용.
      MENTION_EXACT.test(part) ? { type: "mention", value: part } : { type: "text", value: part },
    );

export function tokenizeMessage(content: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let cursor = 0;
  for (const match of content.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const value = trimTrailing(match[0]);
    if (value.length === 0) continue;
    if (start > cursor) tokens.push(...splitMentions(content.slice(cursor, start)));
    // www.만 있으면 브라우저가 상대 경로로 열기 때문에 https를 붙여 줌.
    const href = /^https?:\/\//iu.test(value) ? value : `https://${value}`;
    tokens.push({ type: "url", value, href });
    cursor = start + value.length;
  }
  if (cursor < content.length) tokens.push(...splitMentions(content.slice(cursor)));
  return tokens;
}
