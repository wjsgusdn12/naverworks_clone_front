// 이모지만 1~3개로 된 메시지인지(공백 무시). 이런 메시지는 말풍선 안에서 크게 보여 줌(Slack 등의 큰 이모지 방식).
// 글자 단위(grapheme)로 나눠 👍🏽·👨‍👩‍👧 같은 여러 코드로 된 이모지도 한 개로 셈.
const JUMBO_LIMIT = 3;
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ko", { granularity: "grapheme" })
    : null;

export function isEmojiOnly(content: string) {
  const text = content.replace(/\s/g, "");
  if (!text || !segmenter) return false;
  const graphemes = Array.from(segmenter.segment(text), (part) => part.segment);
  return graphemes.length <= JUMBO_LIMIT && graphemes.every((grapheme) => EMOJI.test(grapheme));
}
