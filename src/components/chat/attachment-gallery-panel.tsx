"use client";

import { AttachmentImage } from "@/components/chat/attachment-image";
import { FileAttachmentCard } from "@/components/chat/file-attachment-card";
import type { PreviewFile } from "@/components/chat/file-preview-modal";
import type { ViewerImage } from "@/components/chat/image-viewer";
import { LoadingInline, LoadingState } from "@/components/common/loading";
import { Tabs } from "@/components/common/tabs";
import {
  chatApi,
  type ChatAttachment,
  type ChatAttachmentItem,
  type ChatAttachmentPage,
} from "@/lib/api/chat-api";
import { FolderOpen, ImageIcon, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Kind = ChatAttachment["kind"];
// 탭별 목록. 처음 받기 전에는 status가 loading, 실패하면 failed.
type TabState = {
  items: ChatAttachmentItem[];
  nextCursor: number | null;
  status: "loading" | "loaded" | "failed";
  loadingMore: boolean;
};
const emptyTab: TabState = { items: [], nextCursor: null, status: "loading", loadingMore: false };

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });

// 방 상세의 사진·파일 모아보기 패널. 사진은 3열 격자, 파일은 목록. 30개씩 이어서 불러옴.
export function AttachmentGalleryPanel({
  roomId,
  accessToken,
  refreshKey,
  onClose,
  onOpenImage,
  onOpenFile,
  onDownload,
}: {
  roomId: number;
  accessToken: string;
  // 새 첨부가 오거나 지워지면 바뀌는 값. 바뀌면 지금 탭의 첫 페이지를 다시 받음.
  refreshKey: string;
  onClose: () => void;
  onOpenImage: (images: ViewerImage[], index: number) => void;
  onOpenFile: (file: PreviewFile) => void;
  onDownload: (attachment: ChatAttachment) => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [tabs, setTabs] = useState<Record<Kind, TabState>>({ IMAGE: emptyTab, FILE: emptyTab });
  const tab = tabs[kind];

  const updateTab = useCallback(
    (target: Kind, change: (current: TabState) => TabState) =>
      setTabs((current) => ({ ...current, [target]: change(current[target]) })),
    [],
  );

  // 첫 페이지 받기. 이미 받은 목록이 있으면 그대로 보여 주면서 새로 받아 교체.
  const loadFirst = useCallback(
    async (target: Kind) => {
      try {
        const page: ChatAttachmentPage = await chatApi.attachments(accessToken, roomId, target);
        updateTab(target, () => ({ ...page, status: "loaded", loadingMore: false }));
      } catch {
        updateTab(target, (current) =>
          current.status === "loading" ? { ...current, status: "failed" } : current,
        );
      }
    },
    [accessToken, roomId, updateTab],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadFirst(kind));
  }, [kind, loadFirst, refreshKey]);

  const loadMore = async () => {
    if (!tab.nextCursor || tab.loadingMore) return;
    const target = kind;
    updateTab(target, (current) => ({ ...current, loadingMore: true }));
    try {
      const page = await chatApi.attachments(accessToken, roomId, target, tab.nextCursor);
      updateTab(target, (current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        status: "loaded",
        loadingMore: false,
      }));
    } catch {
      updateTab(target, (current) => ({ ...current, loadingMore: false }));
    }
  };

  useEffect(() => {
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeByEscape);
    return () => document.removeEventListener("keydown", closeByEscape);
  }, [onClose]);

  const viewerImages: ViewerImage[] = tabs.IMAGE.items.map((item) => ({
    attachment: item.attachment,
    messageId: item.messageId,
    senderName: item.senderName,
    createdAt: item.createdAt,
  }));

  return (
    <aside className="flex h-full w-[min(420px,40vw)] shrink-0 animate-in slide-in-from-right flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-base font-bold">사진·파일</h2>
        <button
          type="button"
          aria-label="사진·파일 모아보기 닫기"
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-slate-500 transition hover:bg-slate-100"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <Tabs<Kind>
        fill
        className="mx-5"
        items={[
          { key: "IMAGE", label: "사진" },
          { key: "FILE", label: "파일" },
        ]}
        value={kind}
        onChange={setKind}
        ariaLabel="첨부 종류"
      />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {tab.status === "loading" ? (
          <LoadingState
            message={
              kind === "IMAGE" ? "사진을 불러오는 중입니다..." : "파일을 불러오는 중입니다..."
            }
            className="h-full min-h-48"
          />
        ) : tab.status === "failed" ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <p>목록을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => {
                updateTab(kind, (current) => ({ ...current, status: "loading" }));
                void loadFirst(kind);
              }}
              className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 font-medium text-blue-600 transition hover:bg-blue-50"
            >
              <RotateCw size={14} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        ) : tab.items.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            {kind === "IMAGE" ? (
              <ImageIcon size={30} className="text-slate-300" aria-hidden="true" />
            ) : (
              <FolderOpen size={30} className="text-slate-300" aria-hidden="true" />
            )}
            <p>{kind === "IMAGE" ? "주고받은 사진이 없습니다." : "주고받은 파일이 없습니다."}</p>
          </div>
        ) : kind === "IMAGE" ? (
          <ul className="grid grid-cols-3 gap-1">
            {tab.items.map((item, index) => (
              <li key={item.attachment.id}>
                <button
                  type="button"
                  aria-label={`${item.senderName}님이 보낸 사진 크게 보기`}
                  onClick={() => onOpenImage(viewerImages, index)}
                  className="block aspect-square w-full cursor-pointer overflow-hidden rounded-md bg-slate-100 transition hover:opacity-85 active:scale-[0.98]"
                >
                  <AttachmentImage attachment={item.attachment} className="h-full w-full" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {tab.items.map((item) => (
              <li key={item.attachment.id}>
                {/* 카드를 누르면 미리보기(그 안에서 "대화에서 보기"로 이동 가능), 오른쪽 버튼은 내려받기. */}
                <FileAttachmentCard
                  attachment={item.attachment}
                  onDownload={() => onDownload(item.attachment)}
                  onOpen={() =>
                    onOpenFile({
                      attachment: item.attachment,
                      messageId: item.messageId,
                      senderName: item.senderName,
                      createdAt: item.createdAt,
                    })
                  }
                  detail={` · ${item.senderName} · ${shortDate(item.createdAt)}`}
                />
              </li>
            ))}
          </ul>
        )}
        {tab.status === "loaded" && tab.nextCursor && (
          <div className="mt-3 flex justify-center">
            {tab.loadingMore ? (
              <LoadingInline message="더 불러오는 중입니다." className="text-xs text-slate-500" />
            ) : (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                더 보기
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
