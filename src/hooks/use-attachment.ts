"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { chatApi, type ChatAttachment } from "@/lib/api/chat-api";
import { saveBlob } from "@/lib/attachment-files";
import { useCallback, useEffect, useState } from "react";

// 같은 사진을 말풍선·모아보기·크게 보기에서 여러 번 받지 않도록 화면용 주소를 기억.
// 너무 많이 쌓이면 가장 먼저 받은 것부터 정리.
const imageUrlCache = new Map<number, Promise<string>>();
const MAX_CACHED_IMAGES = 200;

const loadImageUrl = (token: string, attachmentId: number) => {
  const cached = imageUrlCache.get(attachmentId);
  if (cached) return cached;
  const promise = chatApi
    .attachmentBlob(token, attachmentId, true)
    .then((blob) => URL.createObjectURL(blob));
  // 실패한 요청은 기억하지 않아 다시 시도할 수 있게 함.
  promise.catch(() => imageUrlCache.delete(attachmentId));
  imageUrlCache.set(attachmentId, promise);
  if (imageUrlCache.size > MAX_CACHED_IMAGES) {
    const oldestId = imageUrlCache.keys().next().value!;
    const oldest = imageUrlCache.get(oldestId);
    imageUrlCache.delete(oldestId);
    void oldest?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
  }
  return promise;
};

type ImageResult = { attachmentId: number; url: string | null; failed: boolean };

// 사진 첨부를 받아 <img>에 넣을 주소로 돌려줌. 받는 동안 url=null, 실패하면 failed=true.
export function useAttachmentImage(attachmentId: number | null) {
  const { accessToken } = useAuth();
  const [result, setResult] = useState<ImageResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!accessToken || attachmentId === null) return;
    let alive = true;
    loadImageUrl(accessToken, attachmentId)
      .then((url) => {
        if (alive) setResult({ attachmentId, url, failed: false });
      })
      .catch(() => {
        if (alive) setResult({ attachmentId, url: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [accessToken, attachmentId, attempt]);
  // 다른 사진으로 바뀐 직후에는 이전 결과를 보여 주지 않음.
  const current = result?.attachmentId === attachmentId ? result : null;
  const retry = useCallback(() => {
    setResult(null);
    setAttempt((value) => value + 1);
  }, []);
  return { url: current?.url ?? null, failed: current?.failed ?? false, retry };
}

// 첨부를 원래 파일 이름으로 내려받는 함수. 실패하면 토스트로 안내.
// 버튼마다 받는 중 표시를 따로 하도록 끝날 때까지 기다릴 수 있는 Promise를 돌려줌.
export function useAttachmentDownload(showToast: (message: string) => void) {
  const { accessToken } = useAuth();
  return useCallback(
    async (attachment: Pick<ChatAttachment, "id" | "name">) => {
      if (!accessToken) return;
      try {
        saveBlob(await chatApi.attachmentBlob(accessToken, attachment.id, false), attachment.name);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "파일을 내려받지 못했습니다.");
      }
    },
    [accessToken, showToast],
  );
}

// 내려받기 버튼 한 개의 "받는 중" 상태. 누르는 동안 다시 누를 수 없게 함.
export function useDownloadButton(onDownload: () => Promise<void>) {
  const [downloading, setDownloading] = useState(false);
  const start = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  }, [downloading, onDownload]);
  return { downloading, start };
}
