"use client";

import { LoadingInline, LoadingState } from "@/components/common/loading";
import { Tooltip } from "@/components/common/tooltip";
import {
  chatApi,
  type ChatAttachment,
  type ChatFileSearchItem,
  type ChatMessageSearchItem,
  type ChatSearchPage,
  type ChatSearchRoom,
} from "@/lib/api/chat-api";
import { fileIconOf, formatFileSize } from "@/lib/attachment-files";
import { Download, EyeOff, RotateCw, SearchX, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type Tab = "MESSAGE" | "FILE";
// 탭별 목록. 처음 받기 전에는 status가 loading, 실패하면 failed.
type TabState<T> = {
  items: T[];
  nextCursor: number | null;
  status: "loading" | "loaded" | "failed";
  loadingMore: boolean;
};
type Tabs = { MESSAGE: TabState<ChatMessageSearchItem>; FILE: TabState<ChatFileSearchItem> };
const emptyTabs = (): Tabs => ({
  MESSAGE: { items: [], nextCursor: null, status: "loading", loadingMore: false },
  FILE: { items: [], nextCursor: null, status: "loading", loadingMore: false },
});

// "10/30 오후 2:35"
const shortDateTime = (value: string) => {
  const date = new Date(value);
  const time = date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
};

// 키워드가 뒤쪽에 있으면 앞부분을 "…"로 줄여 한 줄 안에 키워드가 보이게 함.
const snippetOf = (content: string, keyword: string) => {
  const flat = content.replace(/\s+/g, " ");
  const index = flat.toLowerCase().indexOf(keyword.toLowerCase());
  return index > 30 ? `…${flat.slice(index - 20)}` : flat;
};

// 글 속 키워드(대소문자 무시)를 노란 배경으로 강조.
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const lower = text.toLowerCase();
  const target = keyword.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(target);
  while (target && index >= 0) {
    if (index > start) parts.push(text.slice(start, index));
    parts.push(
      <mark key={index} className="rounded-sm bg-yellow-100 px-0.5 text-inherit">
        {text.slice(index, index + target.length)}
      </mark>,
    );
    start = index + target.length;
    index = lower.indexOf(target, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return <>{parts}</>;
}

// 왼쪽 칸: 방 이름(숨긴 방이면 표시).
function RoomCell({ room }: { room: ChatSearchRoom }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-semibold text-slate-800">{room.name}</span>
      {room.hidden && (
        <Tooltip label="목록에서 숨긴 방입니다. 열면 목록에 다시 표시됩니다." className="shrink-0">
          <span className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
            <EyeOff size={11} aria-hidden="true" />
            숨김
          </span>
        </Tooltip>
      )}
    </span>
  );
}

// 메시지 화면 상단 검색 결과. [메시지]는 키워드가 들어간 메시지, [파일]은 파일 이름에 키워드가 들어간 첨부.
// 검색을 다시 실행하면 부모가 key를 바꿔 이 패널을 새로 만듦(이전 결과를 비우고 첫 페이지부터).
export function MessageSearchPanel({
  accessToken,
  keyword,
  onClose,
  onOpenMessage,
  onOpenFile,
  onDownload,
}: {
  accessToken: string;
  keyword: string;
  onClose: () => void;
  onOpenMessage: (item: ChatMessageSearchItem) => void;
  onOpenFile: (item: ChatFileSearchItem) => void;
  onDownload: (attachment: ChatAttachment) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("MESSAGE");
  const [tabs, setTabs] = useState<Tabs>(emptyTabs);

  const fetchPage = useCallback(
    (
      target: Tab,
      cursor?: number,
    ): Promise<ChatSearchPage<ChatMessageSearchItem | ChatFileSearchItem>> =>
      target === "MESSAGE"
        ? chatApi.searchMessages(accessToken, keyword, cursor)
        : chatApi.searchFiles(accessToken, keyword, cursor),
    [accessToken, keyword],
  );

  // 탭의 목록을 바꿈. 두 탭의 항목 형식이 달라 여기서만 형식을 맞춰 넣음.
  const updateTab = useCallback(
    (target: Tab, change: (current: TabState<unknown>) => TabState<unknown>) =>
      setTabs((current) => ({ ...current, [target]: change(current[target]) }) as Tabs),
    [],
  );

  const loadFirst = useCallback(
    async (target: Tab) => {
      try {
        const page = await fetchPage(target);
        updateTab(target, () => ({ ...page, status: "loaded", loadingMore: false }));
      } catch {
        updateTab(target, (current) => ({ ...current, status: "failed" }));
      }
    },
    [fetchPage, updateTab],
  );

  // 탭을 처음 열 때만 받음(이미 받은 탭은 그대로 보여 줌).
  const status = tabs[tab].status;
  useEffect(() => {
    if (status !== "loading") return;
    void Promise.resolve().then(() => loadFirst(tab));
  }, [loadFirst, status, tab]);

  const current = tabs[tab];
  const loadMore = async () => {
    if (!current.nextCursor || current.loadingMore) return;
    const target = tab;
    updateTab(target, (state) => ({ ...state, loadingMore: true }));
    try {
      const page = await fetchPage(target, current.nextCursor);
      updateTab(target, (state) => ({
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        status: "loaded",
        loadingMore: false,
      }));
    } catch {
      updateTab(target, (state) => ({ ...state, loadingMore: false }));
    }
  };

  const tabButton = (target: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === target}
      onClick={() => setTab(target)}
      className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold transition ${tab === target ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
    >
      {label}
      {tabs[target].status === "loaded" && (
        <span className="ml-1 text-xs font-medium text-slate-400">
          {tabs[target].items.length}
          {tabs[target].nextCursor ? "+" : ""}
        </span>
      )}
    </button>
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="min-w-0 truncate text-base font-bold text-slate-900">
          <span className="text-blue-600">&lsquo;{keyword}&rsquo;</span> 검색 결과
        </h2>
        <button
          type="button"
          aria-label="검색 결과 닫기"
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-slate-500 transition hover:bg-slate-100"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="px-6 pt-4">
        <div role="tablist" className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          {tabButton("MESSAGE", "메시지")}
          {tabButton("FILE", "파일")}
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {current.status === "loading" ? (
          <LoadingState message="검색 중입니다..." className="h-full min-h-48" />
        ) : current.status === "failed" ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <p>검색 결과를 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => {
                updateTab(tab, (state) => ({ ...state, status: "loading" }));
              }}
              className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 font-medium text-blue-600 transition hover:bg-blue-50"
            >
              <RotateCw size={14} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        ) : current.items.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <SearchX size={30} className="text-slate-300" aria-hidden="true" />
            <p>
              {tab === "MESSAGE"
                ? "키워드가 들어간 메시지가 없습니다."
                : "파일 이름에 키워드가 들어간 파일이 없습니다."}
            </p>
          </div>
        ) : tab === "MESSAGE" ? (
          <ul className="divide-y divide-slate-100 border-y border-slate-100">
            {tabs.MESSAGE.items.map((item) => (
              <li key={item.messageId}>
                {/* 누르면 그 방을 열고 이 메시지 위치로 이동. */}
                <button
                  type="button"
                  onClick={() => onOpenMessage(item)}
                  className="grid w-full cursor-pointer grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-4 px-2 py-3 text-left text-sm transition hover:bg-slate-50"
                >
                  <RoomCell room={item.room} />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-700">
                      <Highlight text={snippetOf(item.content, keyword)} keyword={keyword} />
                    </span>
                    <span className="block truncate text-xs text-slate-400">{item.senderName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {shortDateTime(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-100 border-y border-slate-100">
            {tabs.FILE.items.map((item) => {
              const { Icon, className } = fileIconOf(item.attachment.name);
              return (
                <li
                  key={item.attachment.id}
                  className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-2 py-2 text-sm"
                >
                  <RoomCell room={item.room} />
                  {/* 파일 이름을 누르면 미리보기(그 안에서 "대화에서 보기"로 이동 가능). */}
                  <button
                    type="button"
                    onClick={() => onOpenFile(item)}
                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-1 text-left transition hover:text-blue-600"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${className}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="truncate">
                      <Highlight text={item.attachment.name} keyword={keyword} />
                    </span>
                  </button>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatFileSize(item.attachment.size)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {shortDateTime(item.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${item.attachment.name} 내려받기`}
                    onClick={() => void onDownload(item.attachment)}
                    className="cursor-pointer rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                  >
                    <Download size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {current.status === "loaded" && current.nextCursor && (
          <div className="mt-3 flex justify-center">
            {current.loadingMore ? (
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
    </section>
  );
}
