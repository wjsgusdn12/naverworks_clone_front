import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeMessage } from "../src/lib/message-tokens.ts";

test("http/https/www 주소를 링크 토큰으로 분리하고 나머지는 텍스트로 둠", () => {
  assert.deepEqual(tokenizeMessage("문서는 https://example.com/docs 참고"), [
    { type: "text", value: "문서는 " },
    { type: "url", value: "https://example.com/docs", href: "https://example.com/docs" },
    { type: "text", value: " 참고" },
  ]);
  assert.deepEqual(tokenizeMessage("www.naver.com 열어봐"), [
    { type: "url", value: "www.naver.com", href: "https://www.naver.com" },
    { type: "text", value: " 열어봐" },
  ]);
});

test("문장 끝 구두점은 링크에서 빼고, 괄호 짝이 맞는 경우는 유지", () => {
  assert.equal(tokenizeMessage("봐 https://a.com/x).")[1].value, "https://a.com/x");
  assert.equal(
    tokenizeMessage("(https://ko.wikipedia.org/wiki/서울_(도시))")[1].value,
    "https://ko.wikipedia.org/wiki/서울_(도시)",
  );
  assert.equal(tokenizeMessage("확인: https://a.com/?q=1&b=2!")[1].value, "https://a.com/?q=1&b=2");
});

test("멘션과 링크가 섞여도 각각 토큰으로 나뉘고, 링크 안의 @는 멘션이 아님", () => {
  assert.deepEqual(tokenizeMessage("@홍길동 https://x.com/@team 확인 @All"), [
    { type: "mention", value: "@홍길동" },
    { type: "text", value: " " },
    { type: "url", value: "https://x.com/@team", href: "https://x.com/@team" },
    { type: "text", value: " 확인 " },
    { type: "mention", value: "@All" },
  ]);
});

test("javascript: 같은 스킴이나 평문은 링크가 되지 않음", () => {
  assert.deepEqual(tokenizeMessage("javascript:alert(1) example.com"), [
    { type: "text", value: "javascript:alert(1) example.com" },
  ]);
});
