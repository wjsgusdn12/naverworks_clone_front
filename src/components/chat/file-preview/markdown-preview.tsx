"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// 마크다운 서식을 입혀 보여 줌(표·체크박스·취소선 포함). 문서 안의 HTML 태그는 그리지 않고,
// javascript: 같은 위험한 링크 주소는 라이브러리가 기본으로 걸러 냄.
const components: Components = {
  h1: (props) => (
    <h1 className="mb-4 mt-6 border-b border-slate-200 pb-2 text-2xl font-bold" {...props} />
  ),
  h2: (props) => (
    <h2 className="mb-3 mt-6 border-b border-slate-200 pb-1.5 text-xl font-bold" {...props} />
  ),
  h3: (props) => <h3 className="mb-2 mt-5 text-lg font-bold" {...props} />,
  h4: (props) => <h4 className="mb-2 mt-4 font-bold" {...props} />,
  p: (props) => <p className="my-3 leading-7" {...props} />,
  ul: (props) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
  ol: (props) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-3 border-l-4 border-slate-300 pl-4 text-slate-600" {...props} />
  ),
  a: (props) => (
    <a className="text-blue-600 underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  code: (props) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]" {...props} />
  ),
  pre: (props) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg bg-slate-100 p-4 font-mono text-[13px] [&_code]:bg-transparent [&_code]:p-0"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table className="border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-left" {...props} />
  ),
  td: (props) => <td className="border border-slate-300 px-3 py-1.5" {...props} />,
  hr: () => <hr className="my-6 border-slate-200" />,
  img: ({ alt }) => <span className="text-slate-400">[이미지: {alt || "설명 없음"}]</span>,
};

export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="h-full overflow-auto bg-white">
      <article className="mx-auto max-w-3xl px-8 py-6 text-[15px] text-slate-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {text}
        </ReactMarkdown>
      </article>
    </div>
  );
}
