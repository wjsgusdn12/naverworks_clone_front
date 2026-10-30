"use client";

import { Spinner } from "@/components/common/loading";
import { useAttachmentImage } from "@/hooks/use-attachment";
import type { ChatAttachment } from "@/lib/api/chat-api";
import { ImageOff, RotateCw } from "lucide-react";

// 사진 첨부 한 장. 받는 동안 가운데 로딩, 실패하면 안내와 다시 시도 버튼.
// 크기·잘림 방식은 부모가 className으로 정함(말풍선·모아보기 칸·크게 보기 공용).
export function AttachmentImage({
  attachment,
  className = "",
  imageClassName = "h-full w-full object-cover",
  tone = "light",
}: {
  attachment: ChatAttachment;
  className?: string;
  imageClassName?: string;
  // dark: 어두운 사진 뷰어 위에서 쓸 때 글자색을 밝게.
  tone?: "light" | "dark";
}) {
  const { url, failed, retry } = useAttachmentImage(attachment.id);
  const muted = tone === "dark" ? "text-slate-300" : "text-slate-400";
  return (
    <span className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {url ? (
        // 토큰을 붙여 받은 Blob 주소라 next/image 최적화 대상이 아님.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={attachment.name} draggable={false} className={imageClassName} />
      ) : failed ? (
        <span className={`flex flex-col items-center gap-1.5 text-xs ${muted}`}>
          <ImageOff size={22} aria-hidden="true" />
          사진을 불러오지 못했습니다.
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              retry();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              retry();
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-medium text-blue-500 transition hover:bg-blue-50/60"
          >
            <RotateCw size={12} aria-hidden="true" />
            다시 시도
          </span>
        </span>
      ) : (
        <span role="status" aria-label="사진을 불러오는 중입니다." className={muted}>
          <Spinner size={22} className="text-blue-500" />
        </span>
      )}
    </span>
  );
}
