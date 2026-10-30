"use client";

import "highlight.js/styles/github.css";
import { useEffect, useState } from "react";

// 코드 파일을 줄 번호와 문법 색칠로 보여 줌. highlight.js는 글자를 이스케이프한 HTML을 만들어 주므로
// 파일 안의 HTML·스크립트가 실행되지 않음. 색칠은 미리보기를 열 때만 불러옴.
export function CodePreview({ text, language }: { text: string; language: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("highlight.js/lib/common")
      .then(({ default: hljs }) => {
        const highlighted = hljs.getLanguage(language)
          ? hljs.highlight(text, { language, ignoreIllegals: true }).value
          : hljs.highlightAuto(text).value;
        if (alive) setHtml(highlighted);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [language, text]);
  const lineCount = text.split("\n").length;
  return (
    <div className="flex h-full overflow-auto bg-white font-mono text-[13px] leading-6">
      <pre
        aria-hidden="true"
        className="sticky left-0 shrink-0 select-none border-r border-slate-200 bg-slate-50 px-3 py-4 text-right text-slate-400"
      >
        {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
      </pre>
      {html === null ? (
        <pre className="min-w-0 flex-1 px-4 py-4 text-slate-800">{text}</pre>
      ) : (
        <pre
          className="hljs min-w-0 flex-1 px-4 py-4"
          style={{ background: "transparent", padding: "1rem" }}
          // highlight.js 결과는 원문 글자를 모두 이스케이프한 색칠용 span만 담고 있음.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
