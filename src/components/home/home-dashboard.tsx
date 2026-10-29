"use client";

import { FavoriteBadge } from "@/components/address-book/favorite-badge";
import { GroupAvatar } from "@/components/chat/group-avatar";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { LoadingInline } from "@/components/common/loading";
import { MeBadge } from "@/components/common/me-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { addressBookApi, type AddressBookMember } from "@/lib/api/address-book-api";
import { chatApi, type ChatRoom } from "@/lib/api/chat-api";
import type { NotificationItem } from "@/lib/api/notification-api";
import {
  ArrowRight,
  Bell,
  BookUser,
  MessageCircleMore,
  NotebookPen,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// 홈은 로그인한 사용자의 실제 데이터만 보여 줌. 목업 데이터 없음.
type HomeDashboardProps = {
  accessToken: string;
  displayName: string;
  membershipId: number;
  showToast: (message: string) => void;
};

// 목록에 보여 줄 최대 개수.
const RECENT_ROOM_LIMIT = 6;
const NOTIFICATION_LIMIT = 5;
const FAVORITE_LIMIT = 6;

// 상대 시각. 오늘이면 시각, 올해면 월·일, 그 외는 연·월·일.
const formatRelative = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
};

export function HomeDashboard({
  accessToken,
  displayName,
  membershipId,
  showToast,
}: HomeDashboardProps) {
  const router = useRouter();
  const { presenceByMembershipId, notifications, notificationCount, notificationsLoaded } =
    useChatNotification();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [favorites, setFavorites] = useState<AddressBookMember[] | null>(null);

  // 채팅방 목록과 즐겨찾기 구성원을 한 번씩 조회. 실패해도 빈 목록으로 두고 안내만 띄움.
  useEffect(() => {
    let cancelled = false;
    chatApi
      .rooms(accessToken)
      .then((result) => {
        if (!cancelled) setRooms(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRooms([]);
        showToast(error instanceof Error ? error.message : "대화 목록을 불러오지 못했습니다.");
      });
    addressBookApi
      .member(
        accessToken,
        new URLSearchParams({
          page: "0",
          size: String(FAVORITE_LIMIT),
          sort: "name",
          direction: "asc",
          favoriteOnly: "true",
        }),
      )
      .then((result) => {
        if (!cancelled) setFavorites(result.content);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFavorites([]);
        showToast(error instanceof Error ? error.message : "즐겨찾기를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, showToast]);

  const today = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  const unreadTotal = (rooms ?? []).reduce((sum, room) => sum + room.unreadCount, 0);
  const onlineCount = Object.entries(presenceByMembershipId).filter(
    ([id, status]) => status === "ONLINE" && Number(id) !== membershipId,
  ).length;
  const recentRooms = [...(rooms ?? [])]
    .filter((room) => room.lastMessageAt !== null)
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
    .slice(0, RECENT_ROOM_LIMIT);
  const recentNotifications = notifications.slice(0, NOTIFICATION_LIMIT);

  // 나와의 채팅은 내 이름을 쓰고 옆에 "나" 딱지를 붙임.
  const roomName = (room: ChatRoom) =>
    room.type === "SELF"
      ? displayName
      : room.type === "DIRECT"
        ? (room.directDisplayName ?? "사용자")
        : (room.name ?? "그룹 메시지");

  const openDirect = async (target: AddressBookMember) => {
    try {
      const room = await chatApi.createDirect(accessToken, target.membershipId);
      router.push(`/message?roomId=${room.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지방을 열지 못했습니다.");
    }
  };

  const openSelf = async () => {
    try {
      const room = await chatApi.createSelf(accessToken);
      router.push(`/message?roomId=${room.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메모방을 열지 못했습니다.");
    }
  };

  const openNotification = (item: NotificationItem) => {
    if (item.linkPath) router.push(item.linkPath);
    else showToast("연결된 화면이 없는 알림입니다.");
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{today}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {displayName}님, 안녕하세요.
            </h1>
          </div>
          <div className="flex gap-2">
            <QuickButton icon={MessageCircleMore} onClick={() => router.push("/message")}>
              메시지
            </QuickButton>
            <QuickButton icon={BookUser} onClick={() => router.push("/addressBook")}>
              주소록
            </QuickButton>
            <QuickButton icon={NotebookPen} onClick={() => void openSelf()}>
              내 메모
            </QuickButton>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatTile
            label="안 읽은 메시지"
            value={rooms === null ? null : unreadTotal}
            suffix="건"
            icon={MessageCircleMore}
            accent="bg-blue-50 text-blue-600"
            onClick={() => router.push("/message")}
          />
          <StatTile
            label="온라인 구성원"
            value={onlineCount}
            suffix="명"
            icon={UsersRound}
            accent="bg-emerald-50 text-emerald-600"
            onClick={() => router.push("/addressBook")}
          />
          <StatTile
            label="읽지 않은 알림"
            value={notificationsLoaded ? notificationCount : null}
            suffix="건"
            icon={Bell}
            accent="bg-amber-50 text-amber-600"
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-12">
          <Card
            className="xl:col-span-7"
            title="최근 대화"
            description="마지막 메시지가 최근인 순서입니다."
            action={<LinkButton onClick={() => router.push("/message")}>전체보기</LinkButton>}
          >
            {rooms === null ? (
              <LoadingInline message="대화 목록을 불러오는 중입니다." className="py-10 text-sm" />
            ) : recentRooms.length === 0 ? (
              <Empty
                message="아직 대화가 없습니다."
                actionLabel="주소록에서 시작하기"
                onAction={() => router.push("/addressBook")}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentRooms.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => router.push(`/message?roomId=${room.id}`)}
                    >
                      {room.type === "GROUP" ? (
                        <GroupAvatar name={room.name ?? "그룹"} />
                      ) : (
                        <UserAvatar
                          size="md"
                          name={
                            room.type === "SELF"
                              ? displayName
                              : (room.directDisplayName ?? "사용자")
                          }
                          presenceStatus={
                            room.type === "SELF"
                              ? "ONLINE"
                              : room.directMembershipId !== null
                                ? (presenceByMembershipId[room.directMembershipId] ?? "OFFLINE")
                                : "OFFLINE"
                          }
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {room.type === "SELF" && <MeBadge />}
                          <b className="truncate text-sm text-slate-900">{roomName(room)}</b>
                          {room.type === "GROUP" && (
                            <span className="shrink-0 text-xs font-bold text-blue-600">
                              {room.memberCount}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {room.lastMessage ?? ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">
                          {formatRelative(room.lastMessageAt)}
                        </span>
                        {room.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                            {room.unreadCount > 999 ? "999+" : room.unreadCount}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-5 xl:col-span-5">
            <Card title="알림" description="최근 30일 알림입니다.">
              {!notificationsLoaded ? (
                <LoadingInline message="알림을 불러오는 중입니다." className="py-8 text-sm" />
              ) : recentNotifications.length === 0 ? (
                <Empty message="새 알림이 없습니다." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentNotifications.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => openNotification(item)}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-slate-200" : "bg-blue-500"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${item.read ? "text-slate-600" : "font-semibold text-slate-900"}`}
                          >
                            {item.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {item.body}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatRelative(item.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="즐겨찾기 구성원"
              description="주소록에서 별표한 구성원입니다."
              action={<LinkButton onClick={() => router.push("/addressBook")}>주소록</LinkButton>}
            >
              {favorites === null ? (
                <LoadingInline message="즐겨찾기를 불러오는 중입니다." className="py-8 text-sm" />
              ) : favorites.length === 0 ? (
                <Empty
                  message="즐겨찾기한 구성원이 없습니다."
                  actionLabel="주소록에서 별표하기"
                  onAction={() => router.push("/addressBook")}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {favorites.map((target) => {
                    const presenceStatus =
                      target.presenceStatus === "INACTIVE"
                        ? target.presenceStatus
                        : (presenceByMembershipId[target.membershipId] ?? target.presenceStatus);
                    return (
                      <li key={target.membershipId} className="flex items-center gap-3 px-2 py-2.5">
                        <UserAvatar
                          size="md"
                          name={target.displayName}
                          presenceStatus={presenceStatus}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {target.membershipId === membershipId && <MeBadge />}
                            <b className="truncate text-sm text-slate-900">{target.displayName}</b>
                            <FavoriteBadge />
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {[target.jobGradeName ?? target.jobTitle, target.departmentName]
                              .filter(Boolean)
                              .join(" · ") || target.companyName}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`${target.displayName}에게 메시지 보내기`}
                          className="cursor-pointer rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50"
                          onClick={() => void openDirect(target)}
                        >
                          <MessageCircleMore size={17} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function QuickButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof MessageCircleMore;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md"
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function StatTile({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  // null이면 아직 불러오는 중.
  value: number | null;
  suffix: string;
  icon: typeof MessageCircleMore;
  accent: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {value === null ? <span className="text-slate-300">–</span> : value}
        <span className="ml-1 text-base font-medium text-slate-500">{suffix}</span>
      </p>
    </Tag>
  );
}

function Card({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
    >
      {children}
      <ArrowRight size={14} />
    </button>
  );
}

function Empty({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
      {message}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// 이름 앞 세 글자 아바타. 우하단 점으로 접속 상태를 표시.
