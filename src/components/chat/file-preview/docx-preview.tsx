"use client";

import { LoadingState } from "@/components/common/loading";
import { useEffect, useRef, useState } from "react";

// Word 문서를 쪽 단위로 그림(글꼴·표·이미지·머리글 반영).
// 문서 내용은 믿을 수 없으므로 스크립트가 실행되지 않는 격리 영역(sandbox iframe) 안에 그림.
// allow-same-origin만 줘서 이 화면은 안을 채울 수 있지만, 문서 안의 스크립트·팝업·화면 이동은 막힘.
export function DocxPreview({ data }: { data: ArrayBuffer }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "done" | "failed">("loading");

  useEffect(() => {
    const frameDocument = frameRef.current?.contentDocument;
    if (!frameReady || !frameDocument) return;
    let alive = true;
    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(data, frameDocument.body, frameDocument.head, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
        }),
      )
      .then(() => {
        if (alive) setStatus("done");
      })
      .catch(() => {
        if (alive) setStatus("failed");
      });
    return () => {
      alive = false;
    };
  }, [data, frameReady]);

  return (
    <div className="relative h-full">
      <iframe
        ref={frameRef}
        title="Word 문서 미리보기"
        sandbox="allow-same-origin"
        srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#f1f5f9'></body></html>"
        onLoad={() => setFrameReady(true)}
        className={`h-full w-full ${status === "done" ? "" : "invisible"}`}
      />
      {status === "loading" && (
        <LoadingState message="문서를 그리는 중입니다..." size="md" className="absolute inset-0" />
      )}
      {status === "failed" && (
        <p className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-600">
          [미리보기 실패] 문서 형식을 읽을 수 없음 · 내려받아 확인
        </p>
      )}
    </div>
  );
}
