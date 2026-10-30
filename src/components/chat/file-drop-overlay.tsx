"use client";

import { MAX_ATTACHMENT_COUNT } from "@/lib/attachment-files";
import { CloudUpload } from "lucide-react";

// 대화 영역에 파일을 끌어 왔을 때 덮는 안내. 마우스 이벤트는 아래 영역이 그대로 받도록 통과.
export function FileDropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/85 text-blue-600 backdrop-blur-[1px] animate-in fade-in">
      <CloudUpload size={40} strokeWidth={1.6} aria-hidden="true" />
      <p className="text-base font-bold">여기에 놓으면 첨부됩니다</p>
      <p className="text-xs text-blue-500">
        사진·파일 한 번에 {MAX_ATTACHMENT_COUNT}개까지, 하나당 20MB까지
      </p>
    </div>
  );
}
