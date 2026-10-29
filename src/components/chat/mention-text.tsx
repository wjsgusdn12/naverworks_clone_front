"use client";

import { tokenizeMessage } from "@/lib/message-tokens";

export function MentionText({ content }: { content: string }) {
  // 저장된 본문은 그대로 두고 화면에서만 @멘션 강조와 URL 링크를 입힘(복사/검색 동작 유지).
  return (
    <>
      {tokenizeMessage(content).map((token, index) => {
        if (token.type === "mention")
          return (
            <span key={index} className="text-blue-600">
              {token.value}
            </span>
          );
        if (token.type === "url")
          return (
            <a
              key={index}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              // 말풍선의 우클릭 메뉴·드래그와 겹치지 않게 링크 클릭은 여기서 끝냄.
              onClick={(event) => event.stopPropagation()}
              className="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 hover:decoration-blue-500"
            >
              {token.value}
            </a>
          );
        return token.value;
      })}
    </>
  );
}
