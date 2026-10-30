"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { LoadingInline, LoadingState } from "@/components/common/loading";
import { MeBadge } from "@/components/common/me-badge";
import { Tabs } from "@/components/common/tabs";
import { Tooltip } from "@/components/common/tooltip";
import {
  chatApi,
  type ChatAttachment,
  type ChatFileSearchItem,
  type ChatMessageSearchItem,
  type ChatMessageSearchRoomItem,
  type ChatSearchPage,
  type ChatSearchRoom,
} from "@/lib/api/chat-api";
import { fileIconOf, formatFileSize } from "@/lib/attachment-files";
import { ChevronRight, Download, EyeOff, Forward, RotateCw, SearchX, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type Tab = "MESSAGE" | "FILE";
type Status = "loading" | "loaded" | "failed";
// 이어서 불러오는 목록(오른쪽 메시지·파일). 처음 받기 전에는 status가 loading, 실패하면 failed.
type PagedList<T> = {
  items: T[];
  nextCursor: number | null;
  status: Status;
  loadingMore: boolean;
};
const emptyList = <T,>(): PagedList<T> => ({
  items: [],
  nextCursor: null,
  status: "loading",
  loadingMore: false,
});

// 오늘이면 "오후 3:28", 올해면 "10. 1.", 그 전이면 "2025. 10. 1."
const dateLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  const monthDay = `${date.getMonth() + 1}. ${date.getDate()}.`;
  return date.getFullYear() === now.getFullYear() ? monthDay : `${date.getFullYear()}. ${monthDay}`;
};

// 한 줄이 길고 키워드가 뒤쪽에 있으면 앞부분을 "…"로 줄여 키워드가 보이게 함.
const snippetOf = (line: string, keyword: string) => {
  const index = line.toLowerCase().indexOf(keyword.toLowerCase());
  return index > 40 ? `…${line.slice(index - 25)}` : line;
};

// 메시지에서 키워드가 있는 줄(과 그 앞 줄)을 최대 두 줄 보여 줌. 뒤에 줄이 더 있으면 "…".
const previewLinesOf = (content: string, keyword: string) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const found = lines.findIndex((line) => line.toLowerCase().includes(keyword.toLowerCase()));
  const start = found <= 0 ? 0 : found - 1;
  const shown = lines.slice(start, start + 2).map((line) => snippetOf(line, keyword));
  if (start + 2 < lines.length && shown.length > 0) shown[shown.length - 1] += " …";
  return shown;
};

// 글 속 키워드(대소문자 무시)를 파란 굵은 글씨로 강조.
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const lower = text.toLowerCase();
  const target = keyword.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(target);
  while (target && index >= 0) {
    if (index > start) parts.push(text.slice(start, index));
    parts.push(
      <b key={index} className="font-bold text-blue-600">
        {text.slice(index, index + target.length)}
      </b>,
    );
    start = index + target.length;
    index = lower.indexOf(target, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return <>{parts}</>;
}

// 숨긴 방 표시. 결과를 열면 왼쪽 메시지방 목록에 다시 나타남.
function HiddenBadge() {
  return (
    <Tooltip label="목록에서 숨긴 방입니다. 열면 목록에 다시 표시됩니다." className="shrink-0">
      <span className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
        <EyeOff size={11} aria-hidden="true" />
        숨김
      </span>
    </Tooltip>
  );
}

// 다시 시도 안내(목록을 받지 못했을 때).
function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
      <p>검색 결과를 불러오지 못했습니다.</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 font-medium text-blue-600 transition hover:bg-blue-50"
      >
        <RotateCw size={14} aria-hidden="true" />
        다시 시도
      </button>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500">
      <SearchX size={30} className="text-slate-300" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function MoreButton({ list, onMore }: { list: PagedList<unknown>; onMore: () => void }) {
  if (list.status !== "loaded" || !list.nextCursor) return null;
  return (
    <div className="my-3 flex justify-center">
      {list.loadingMore ? (
        <LoadingInline message="더 불러오는 중입니다." className="text-xs text-slate-500" />
      ) : (
        <button
          type="button"
          onClick={onMore}
          className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          더 보기
        </button>
      )}
    </div>
  );
}

// 메시지 화면 상단 검색 결과.
// [메시지] 왼쪽은 키워드가 들어간 메시지가 있는 방(방별 개수), 오른쪽은 고른 방의 메시지.
// [파일] 파일 이름에 키워드가 들어간 첨부 목록.
// 검색을 다시 실행하면 부모가 key를 바꿔 이 패널을 새로 만듦(이전 결과를 비우고 처음부터).
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
  const { member } = useAuth();
  const { presenceByMembershipId, memberStatusByMembershipId, myStatusType } =
    useChatNotification();
  const [tab, setTab] = useState<Tab>("MESSAGE");
  const [rooms, setRooms] = useState<{ status: Status; items: ChatMessageSearchRoomItem[] }>({
    status: "loading",
    items: [],
  });
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<number, PagedList<ChatMessageSearchItem>>
  >({});
  const [files, setFiles] = useState<PagedList<ChatFileSearchItem>>(emptyList);

  // 사람 아바타(접속 점·상태 아이콘 포함). 나와의 채팅은 내 상태.
  const personAvatar = (membershipId: number | null, name: string) => {
    const isMe = membershipId !== null && membershipId === member?.membershipId;
    return (
      <MessageMemberAvatar
        name={name}
        presenceStatus={isMe ? "ONLINE" : (presenceByMembershipId[membershipId ?? -1] ?? "OFFLINE")}
        statusType={
          isMe ? myStatusType : memberStatusByMembershipId[membershipId ?? -1]?.statusType
        }
      />
    );
  };
  const roomAvatar = (room: ChatSearchRoom) =>
    room.type === "GROUP" ? (
      <GroupAvatar name={room.name} />
    ) : (
      personAvatar(
        room.type === "SELF" ? (member?.membershipId ?? null) : room.directMembershipId,
        room.name,
      )
    );

  // 왼쪽 방 목록. 받으면 첫 방을 골라 둠.
  const loadRooms = useCallback(async () => {
    try {
      const items = await chatApi.searchMessageRooms(accessToken, keyword);
      setRooms({ status: "loaded", items });
      setSelectedRoomId((current) => current ?? items[0]?.room.id ?? null);
    } catch {
      setRooms({ status: "failed", items: [] });
    }
  }, [accessToken, keyword]);

  useEffect(() => {
    if (rooms.status !== "loading") return;
    void Promise.resolve().then(loadRooms);
  }, [loadRooms, rooms.status]);

  // 오른쪽 메시지 목록: 고른 방을 처음 볼 때만 받음(이미 받은 방은 그대로 보여 줌).
  const updateMessages = useCallback(
    (
      roomId: number,
      change: (current: PagedList<ChatMessageSearchItem>) => PagedList<ChatMessageSearchItem>,
    ) =>
      setMessagesByRoom((current) => ({
        ...current,
        [roomId]: change(current[roomId] ?? emptyList()),
      })),
    [],
  );
  const selectedMessages = selectedRoomId === null ? null : messagesByRoom[selectedRoomId];
  const messagesStatus = selectedMessages?.status ?? "loading";
  useEffect(() => {
    if (selectedRoomId === null || messagesStatus !== "loading") return;
    const roomId = selectedRoomId;
    void Promise.resolve().then(async () => {
      try {
        const page = await chatApi.searchMessages(accessToken, keyword, roomId);
        updateMessages(roomId, () => ({ ...page, status: "loaded", loadingMore: false }));
      } catch {
        updateMessages(roomId, (current) => ({ ...current, status: "failed" }));
      }
    });
  }, [accessToken, keyword, messagesStatus, selectedRoomId, updateMessages]);

  const loadMoreMessages = async () => {
    if (selectedRoomId === null || !selectedMessages?.nextCursor || selectedMessages.loadingMore)
      return;
    const roomId = selectedRoomId;
    updateMessages(roomId, (current) => ({ ...current, loadingMore: true }));
    try {
      const page = await chatApi.searchMessages(
        accessToken,
        keyword,
        roomId,
        selectedMessages.nextCursor,
      );
      updateMessages(roomId, (current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        status: "loaded",
        loadingMore: false,
      }));
    } catch {
      updateMessages(roomId, (current) => ({ ...current, loadingMore: false }));
    }
  };

  // 파일 목록: 파일 탭을 처음 열 때 받음.
  const loadFiles = useCallback(
    async (cursor?: number) => {
      try {
        const page: ChatSearchPage<ChatFileSearchItem> = await chatApi.searchFiles(
          accessToken,
          keyword,
          cursor,
        );
        setFiles((current) => ({
          items: cursor ? [...current.items, ...page.items] : page.items,
          nextCursor: page.nextCursor,
          status: "loaded",
          loadingMore: false,
        }));
      } catch {
        setFiles((current) =>
          cursor ? { ...current, loadingMore: false } : { ...current, status: "failed" },
        );
      }
    },
    [accessToken, keyword],
  );
  useEffect(() => {
    if (tab !== "FILE" || files.status !== "loading") return;
    void Promise.resolve().then(() => loadFiles());
  }, [files.status, loadFiles, tab]);

  const messageTotal = rooms.items.reduce((sum, item) => sum + item.count, 0);
  const selectedRoom = rooms.items.find((item) => item.room.id === selectedRoomId)?.room ?? null;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white px-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">검색 결과</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          <X size={16} aria-hidden="true" />
          검색 종료하기
        </button>
      </div>
      <Tabs<Tab>
        className="mt-5"
        items={[
          {
            key: "MESSAGE",
            label: "메시지",
            count: rooms.status === "loaded" ? messageTotal : undefined,
          },
          {
            key: "FILE",
            label: "파일",
            count:
              files.status === "loaded"
                ? `${files.items.length}${files.nextCursor ? "+" : ""}`
                : undefined,
          },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="검색 결과 종류"
      />

      {tab === "MESSAGE" ? (
        rooms.status === "loading" ? (
          <LoadingState message="검색 중입니다..." className="min-h-48 flex-1" />
        ) : rooms.status === "failed" ? (
          <Failed onRetry={() => setRooms({ status: "loading", items: [] })} />
        ) : rooms.items.length === 0 ? (
          <Empty message="키워드가 들어간 메시지가 없습니다." />
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* 왼쪽: 방별 묶음 */}
            <ul className="w-1/2 min-w-0 max-w-xl shrink-0 overflow-y-auto border-r border-slate-200 py-2 pr-2">
              {rooms.items.map(({ room, count }) => (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    aria-current={room.id === selectedRoomId}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition ${room.id === selectedRoomId ? "bg-blue-100" : "hover:bg-slate-50"}`}
                  >
                    {roomAvatar(room)}
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {room.type === "SELF" && <MeBadge />}
                        <b className="truncate text-sm text-slate-900">{room.name}</b>
                        {room.type === "GROUP" && (
                          <span className="shrink-0 text-sm font-bold text-blue-600">
                            {room.memberCount}
                          </span>
                        )}
                        {room.hidden && <HiddenBadge />}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {count} 개의 메시지
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
            {/* 오른쪽: 고른 방의 메시지. 누르면 그 방을 열고 메시지 위치로 이동. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="border-b border-slate-200 px-4 py-4 text-base font-bold text-slate-900">
                {selectedRoom?.name}
              </h3>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!selectedMessages || selectedMessages.status === "loading" ? (
                  <LoadingState message="메시지를 불러오는 중입니다..." className="min-h-48" />
                ) : selectedMessages.status === "failed" ? (
                  <Failed
                    onRetry={() =>
                      selectedRoomId !== null && updateMessages(selectedRoomId, () => emptyList())
                    }
                  />
                ) : (
                  <>
                    <ul>
                      {selectedMessages.items.map((item) => (
                        <li key={item.messageId}>
                          <button
                            type="button"
                            onClick={() => onOpenMessage(item)}
                            className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            {personAvatar(item.senderMembershipId, item.senderName)}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-3">
                                <b className="truncate text-sm text-slate-900">{item.senderName}</b>
                                <span className="shrink-0 text-xs text-slate-400">
                                  {dateLabel(item.createdAt)}
                                </span>
                              </span>
                              {previewLinesOf(item.content, keyword).map((line, index) => (
                                <span
                                  key={index}
                                  className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-600"
                                >
                                  {index === 0 && item.forwarded && (
                                    <Forward
                                      size={13}
                                      className="shrink-0 text-slate-400"
                                      aria-label="전달된 메시지"
                                    />
                                  )}
                                  <span className="truncate">
                                    <Highlight text={line} keyword={keyword} />
                                  </span>
                                </span>
                              ))}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <MoreButton list={selectedMessages} onMore={() => void loadMoreMessages()} />
                  </>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          {files.status === "loading" ? (
            <LoadingState message="검색 중입니다..." className="min-h-48" />
          ) : files.status === "failed" ? (
            <Failed onRetry={() => setFiles(emptyList())} />
          ) : files.items.length === 0 ? (
            <Empty message="파일 이름에 키워드가 들어간 파일이 없습니다." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {files.items.map((item) => {
                const { Icon, className } = fileIconOf(item.attachment.name);
                return (
                  <li
                    key={item.attachment.id}
                    className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-2 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-semibold text-slate-800">
                        {item.room.name}
                      </span>
                      {item.room.hidden && <HiddenBadge />}
                    </span>
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
                      {dateLabel(item.createdAt)}
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
          <MoreButton
            list={files}
            onMore={() => {
              if (!files.nextCursor || files.loadingMore) return;
              setFiles((current) => ({ ...current, loadingMore: true }));
              void loadFiles(files.nextCursor);
            }}
          />
        </div>
      )}
    </section>
  );
}
