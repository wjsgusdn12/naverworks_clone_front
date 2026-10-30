"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { RoomActionMenu, type RoomMenuAction } from "@/components/chat/room-action-menu";
import { LoadingInline, LoadingState } from "@/components/common/loading";
import { MeBadge } from "@/components/common/me-badge";
import { Tabs } from "@/components/common/tabs";
import { Tooltip } from "@/components/common/tooltip";
import {
  chatApi,
  type ChatAttachment,
  type ChatFileSearchItem,
  type ChatMessageSearchItem,
  type ChatSearchPage,
  type ChatSearchRoom,
  type ChatSearchRoomItem,
} from "@/lib/api/chat-api";
import { fileIconOf, formatFileSize } from "@/lib/attachment-files";
import {
  ChevronRight,
  Download,
  EyeOff,
  Forward,
  MoreVertical,
  RotateCw,
  SearchX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type Tab = "MESSAGE" | "FILE";
type Status = "loading" | "loaded" | "failed";
// 오른쪽에 이어서 불러오는 목록. 처음 받기 전에는 status가 loading, 실패하면 failed.
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

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-48 flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500">
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
    <div className="flex h-full min-h-48 flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500">
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

// 탭 하나의 검색 상태: 왼쪽 방 목록(방별 개수) + 고른 방의 결과 목록(방마다 따로 보관, 30개씩).
// 탭을 누르기 전에도 방 목록과 첫 방의 결과를 미리 받아 둠.
function useSearchTab<T>(
  fetchRooms: () => Promise<ChatSearchRoomItem[]>,
  fetchPage: (roomId: number, cursor?: number) => Promise<ChatSearchPage<T>>,
) {
  const [rooms, setRooms] = useState<{ status: Status; items: ChatSearchRoomItem[] }>({
    status: "loading",
    items: [],
  });
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [lists, setLists] = useState<Record<number, PagedList<T>>>({});

  useEffect(() => {
    if (rooms.status !== "loading") return;
    void Promise.resolve().then(async () => {
      try {
        const items = await fetchRooms();
        setRooms({ status: "loaded", items });
        setSelectedRoomId((current) => current ?? items[0]?.room.id ?? null);
      } catch {
        setRooms({ status: "failed", items: [] });
      }
    });
  }, [fetchRooms, rooms.status]);

  const updateList = useCallback(
    (roomId: number, change: (current: PagedList<T>) => PagedList<T>) =>
      setLists((current) => ({ ...current, [roomId]: change(current[roomId] ?? emptyList()) })),
    [],
  );
  const list = selectedRoomId === null ? null : (lists[selectedRoomId] ?? null);
  const listStatus = list?.status ?? "loading";
  // 고른 방의 결과는 처음 볼 때만 받음(이미 받은 방은 그대로).
  useEffect(() => {
    if (selectedRoomId === null || listStatus !== "loading") return;
    const roomId = selectedRoomId;
    void Promise.resolve().then(async () => {
      try {
        const page = await fetchPage(roomId);
        updateList(roomId, () => ({ ...page, status: "loaded", loadingMore: false }));
      } catch {
        updateList(roomId, (current) => ({ ...current, status: "failed" }));
      }
    });
  }, [fetchPage, listStatus, selectedRoomId, updateList]);

  const loadMore = async () => {
    if (selectedRoomId === null || !list?.nextCursor || list.loadingMore) return;
    const roomId = selectedRoomId;
    updateList(roomId, (current) => ({ ...current, loadingMore: true }));
    try {
      const page = await fetchPage(roomId, list.nextCursor);
      updateList(roomId, (current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        status: "loaded",
        loadingMore: false,
      }));
    } catch {
      updateList(roomId, (current) => ({ ...current, loadingMore: false }));
    }
  };

  // ⋮ 메뉴 결과 반영: 나간 방은 빼고(고른 방이면 다음 방을 고름), 숨김·숨김 해제는 표시만 바꿈.
  const applyRoomChange = (roomId: number, change: "left" | "hidden" | "shown") => {
    if (change === "left") {
      const remaining = rooms.items.filter((item) => item.room.id !== roomId);
      setRooms((current) => ({ ...current, items: remaining }));
      if (selectedRoomId === roomId) setSelectedRoomId(remaining[0]?.room.id ?? null);
      return;
    }
    setRooms((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.room.id === roomId
          ? { ...item, room: { ...item.room, hidden: change === "hidden" } }
          : item,
      ),
    }));
  };

  return {
    rooms,
    retryRooms: () => setRooms({ status: "loading", items: [] }),
    selectedRoomId,
    setSelectedRoomId,
    selectedRoom: rooms.items.find((item) => item.room.id === selectedRoomId)?.room ?? null,
    list,
    retryList: () => selectedRoomId !== null && updateList(selectedRoomId, () => emptyList()),
    loadMore,
    applyRoomChange,
    total: rooms.items.reduce((sum, item) => sum + item.count, 0),
  };
}

// 메시지 화면 상단 검색 결과. [메시지]·[파일] 모두 왼쪽은 결과가 있는 방(방별 개수),
// 오른쪽은 고른 방의 메시지·파일. 방에 마우스를 올리면 ⋮ 메뉴(알림 설정·핀 고정·숨김·나가기).
// 검색을 다시 실행하면 부모가 key를 바꿔 이 패널을 새로 만듦(이전 결과를 비우고 처음부터).
export function MessageSearchPanel({
  accessToken,
  keyword,
  onClose,
  onOpenMessage,
  onOpenFile,
  onDownload,
  isRoomPinned,
  onRoomAction,
}: {
  accessToken: string;
  keyword: string;
  onClose: () => void;
  onOpenMessage: (item: ChatMessageSearchItem) => void;
  onOpenFile: (item: ChatFileSearchItem) => void;
  onDownload: (attachment: ChatAttachment) => Promise<void>;
  isRoomPinned: (roomId: number) => boolean;
  // 성공하면 true. 그때 검색 결과 쪽 표시도 맞춰 바꿈.
  onRoomAction: (roomId: number, action: RoomMenuAction) => Promise<boolean>;
}) {
  const { member } = useAuth();
  const { presenceByMembershipId, memberStatusByMembershipId, myStatusType } =
    useChatNotification();
  const [tab, setTab] = useState<Tab>("MESSAGE");
  const [menu, setMenu] = useState<{
    room: ChatSearchRoom;
    position: { left: number; top: number };
  } | null>(null);

  const messages = useSearchTab<ChatMessageSearchItem>(
    useCallback(() => chatApi.searchMessageRooms(accessToken, keyword), [accessToken, keyword]),
    useCallback(
      (roomId: number, cursor?: number) =>
        chatApi.searchMessages(accessToken, keyword, roomId, cursor),
      [accessToken, keyword],
    ),
  );
  const files = useSearchTab<ChatFileSearchItem>(
    useCallback(() => chatApi.searchFileRooms(accessToken, keyword), [accessToken, keyword]),
    useCallback(
      (roomId: number, cursor?: number) =>
        chatApi.searchFiles(accessToken, keyword, roomId, cursor),
      [accessToken, keyword],
    ),
  );
  const current = tab === "MESSAGE" ? messages : files;

  // 메뉴 밖을 누르면 닫음.
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-room-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const runRoomAction = async (room: ChatSearchRoom, action: RoomMenuAction) => {
    setMenu(null);
    if (!(await onRoomAction(room.id, action))) return;
    const change =
      action === "leave"
        ? "left"
        : action === "hide"
          ? "hidden"
          : action === "unhide"
            ? "shown"
            : null;
    if (!change) return;
    messages.applyRoomChange(room.id, change);
    files.applyRoomChange(room.id, change);
  };

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

  const countLabel = (state: { rooms: { status: Status }; total: number }) =>
    state.rooms.status === "loaded" ? state.total : undefined;

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
          { key: "MESSAGE", label: "메시지", count: countLabel(messages) },
          { key: "FILE", label: "파일", count: countLabel(files) },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="검색 결과 종류"
      />

      {current.rooms.status === "loading" ? (
        <LoadingState message="검색 중입니다..." className="min-h-48 flex-1" />
      ) : current.rooms.status === "failed" ? (
        <Failed onRetry={current.retryRooms} />
      ) : current.rooms.items.length === 0 ? (
        <Empty
          message={
            tab === "MESSAGE"
              ? "키워드가 들어간 메시지가 없습니다."
              : "파일 이름에 키워드가 들어간 파일이 없습니다."
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* 왼쪽: 결과가 있는 방(방별 개수). 마우스를 올리면 ⋮ 메뉴. */}
          <ul className="w-1/2 min-w-0 max-w-xl shrink-0 overflow-y-auto border-r border-slate-200 py-2 pr-2">
            {current.rooms.items.map(({ room, count }) => {
              const selected = room.id === current.selectedRoomId;
              const menuOpen = menu?.room.id === room.id;
              return (
                <li key={room.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => current.setSelectedRoomId(room.id)}
                    aria-current={selected}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg py-3 pl-3 pr-16 text-left transition ${selected ? "bg-blue-100" : "hover:bg-slate-50"}`}
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
                        {count} 개의 {tab === "MESSAGE" ? "메시지" : "파일"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-room-menu
                    aria-label={`${room.name} 메뉴`}
                    aria-expanded={menuOpen}
                    onClick={(event) => {
                      if (menuOpen) {
                        setMenu(null);
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMenu({ room, position: { left: rect.left, top: rect.bottom + 6 } });
                    }}
                    className={`absolute right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-slate-600 transition hover:bg-slate-200 group-hover:opacity-100 ${menuOpen ? "opacity-100" : "opacity-0 focus-visible:opacity-100"}`}
                  >
                    <MoreVertical size={17} aria-hidden="true" />
                  </button>
                  <ChevronRight
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </li>
              );
            })}
          </ul>
          {/* 오른쪽: 고른 방의 결과 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="border-b border-slate-200 px-4 py-4 text-base font-bold text-slate-900">
              {current.selectedRoom?.name}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!current.list || current.list.status === "loading" ? (
                <LoadingState
                  message={
                    tab === "MESSAGE"
                      ? "메시지를 불러오는 중입니다..."
                      : "파일을 불러오는 중입니다..."
                  }
                  className="min-h-48"
                />
              ) : current.list.status === "failed" ? (
                <Failed onRetry={current.retryList} />
              ) : (
                <>
                  {tab === "MESSAGE" ? (
                    <ul>
                      {(messages.list?.items ?? []).map((item) => (
                        <li key={item.messageId}>
                          {/* 누르면 그 방을 열고 메시지 위치로 이동. */}
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
                  ) : (
                    <ul>
                      {(files.list?.items ?? []).map((item) => {
                        const { Icon, className } = fileIconOf(item.attachment.name);
                        return (
                          <li
                            key={item.attachment.id}
                            className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                          >
                            {/* 누르면 미리보기(그 안에서 "대화에서 보기"로 이동 가능). */}
                            <button
                              type="button"
                              onClick={() => onOpenFile(item)}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                            >
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${className}`}
                              >
                                <Icon size={18} aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-3">
                                  <b className="truncate text-sm font-semibold text-slate-900">
                                    <Highlight text={item.attachment.name} keyword={keyword} />
                                  </b>
                                  <span className="shrink-0 text-xs text-slate-400">
                                    {dateLabel(item.createdAt)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {item.senderName} · {formatFileSize(item.attachment.size)}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`${item.attachment.name} 내려받기`}
                              onClick={() => void onDownload(item.attachment)}
                              className="shrink-0 cursor-pointer rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                            >
                              <Download size={16} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <MoreButton list={current.list} onMore={() => void current.loadMore()} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {menu && (
        <RoomActionMenu
          position={menu.position}
          pinned={isRoomPinned(menu.room.id)}
          hidden={menu.room.hidden}
          onAction={(action) => void runRoomAction(menu.room, action)}
        />
      )}
    </section>
  );
}
