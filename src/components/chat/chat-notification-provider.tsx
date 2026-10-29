"use client";

import { MessageNotificationToast } from "@/components/common/message-notification-toast";
import { useAuth } from "@/components/auth/auth-provider";
import { chatApi, type ChatRoom } from "@/lib/api/chat-api";
import { connectChatNotification, type PresenceRealtimeEvent } from "@/lib/realtime/chat-realtime";
import { addressBookApi, type MemberStatus, type PresenceStatus } from "@/lib/api/address-book-api";
import type { MemberStatusType } from "@/lib/status-options";
import { notificationApi, type NotificationItem } from "@/lib/api/notification-api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMessageNotificationToast } from "@/hooks/use-message-notification-toast";
import { useRouter } from "next/navigation";
import { applyRoomMessageChange } from "@/lib/chat-message-state";

type ChatNotificationContextValue = {
  notificationCount: number;
  notifications: NotificationItem[];
  // 서버에서 최근 30일 알림을 한 번이라도 받아왔는지(패널의 "불러오는 중" 표시용).
  notificationsLoaded: boolean;
  notificationEnabled: boolean;
  notificationMode: "ALL" | "MENTION" | "NONE";
  // WebSocket으로 받은 구성원별 최신 접속 상태(ONLINE/OFFLINE/AWAY). REST 조회 결과 위에 덮어씀.
  presenceByMembershipId: Record<number, PresenceStatus>;
  memberStatusByMembershipId: Record<number, MemberStatus>;
  // 내 상태 설정. 본인 아바타 배지에 씀.
  myStatusType: MemberStatusType | null;
  activeChatRoomId: number | null;
  acknowledgeNotifications: () => void;
  markNotificationRead: (notificationId: number) => void;
  setNotificationEnabled: (enabled: boolean) => void;
  setNotificationMode: (mode: "ALL" | "MENTION" | "NONE") => void;
  setActiveChatRoomId: (chatRoomId: number | null) => void;
  syncChatRooms: (rooms: ChatRoom[]) => void;
  refreshChatRooms: () => Promise<ChatRoom[]>;
};

const ChatNotificationContext = createContext<ChatNotificationContextValue | null>(null);

export function ChatNotificationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { accessToken, member, status } = useAuth();
  // 알림 목록은 서버(notification 테이블)가 원본. 실시간 이벤트는 그 위에 새 항목만 얹음.
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationMode, setNotificationModeState] = useState<"ALL" | "MENTION" | "NONE">(() => {
    if (typeof window === "undefined") return "ALL";
    const stored = window.localStorage.getItem("naverworks:notificationMode");
    return stored === "MENTION" || stored === "NONE" ? stored : "ALL";
  });
  const [activeChatRoomId, setActiveChatRoomId] = useState<number | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [presenceByMembershipId, setPresenceByMembershipId] = useState<
    Record<number, PresenceStatus>
  >({});
  // 실시간으로 받은 구성원별 상태 설정(바쁨·휴가 등).
  const [memberStatusByMembershipId, setMemberStatusByMembershipId] = useState<
    Record<number, MemberStatus>
  >({});
  const roomRef = useRef<ChatRoom[]>([]);
  const refreshRequestRef = useRef<{ token: string; promise: Promise<ChatRoom[]> } | null>(null);
  const activeChatRoomIdRef = useRef<number | null>(null);
  const {
    messageNotification,
    showMessageNotification,
    dismissMessageNotification,
    updateMessageNotification,
  } = useMessageNotificationToast();

  const syncChatRooms = useCallback((rooms: ChatRoom[]) => {
    roomRef.current = rooms;
    setChatRooms(rooms);
  }, []);

  const refreshChatRooms = useCallback((): Promise<ChatRoom[]> => {
    if (!accessToken) return Promise.resolve([]);
    // 전역 알림과 메시지 화면이 같은 삭제 이벤트를 받아도 목록 API는 한 번만 요청.
    if (refreshRequestRef.current?.token === accessToken) return refreshRequestRef.current.promise;
    const promise = chatApi
      .rooms(accessToken)
      .then((result) => {
        if (refreshRequestRef.current?.token === accessToken) syncChatRooms(result);
        return result;
      })
      .finally(() => {
        if (refreshRequestRef.current?.promise === promise) refreshRequestRef.current = null;
      });
    refreshRequestRef.current = { token: accessToken, promise };
    return promise;
  }, [accessToken, syncChatRooms]);

  const setNotificationEnabled = useCallback((enabled: boolean) => {
    const nextMode = enabled ? "ALL" : "NONE";
    setNotificationModeState(nextMode);
    window.localStorage.setItem("naverworks:notificationMode", nextMode);
  }, []);

  const setNotificationMode = useCallback((mode: "ALL" | "MENTION" | "NONE") => {
    setNotificationModeState(mode);
    window.localStorage.setItem("naverworks:notificationMode", mode);
  }, []);
  const notificationEnabled = notificationMode !== "NONE";

  // 화면은 먼저 바꾸고 서버 반영은 뒤에서 처리(실패해도 다음 조회 때 서버 값으로 돌아옴).
  const acknowledgeNotifications = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    if (accessToken) void notificationApi.readAll(accessToken).catch(() => undefined);
  }, [accessToken]);

  const markNotificationRead = useCallback(
    (notificationId: number) => {
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      );
      if (accessToken)
        void notificationApi.read(accessToken, notificationId).catch(() => undefined);
    },
    [accessToken],
  );

  const notificationCount = notifications.filter((item) => !item.read).length;

  // 보고 있는 방으로 연결되는 알림은 사용자가 내용을 이미 확인한 것이므로 자동으로 읽음 처리.
  // 방에 들어온 순간 쌓여 있던 알림과, 방을 보는 중에 새로 온 알림 모두 해당.
  const activeRoomLinkPath =
    activeChatRoomId === null ? null : `/message?roomId=${activeChatRoomId}`;
  useEffect(() => {
    if (!activeRoomLinkPath) return;
    const pending = notifications.filter(
      (item) => !item.read && item.linkPath === activeRoomLinkPath,
    );
    if (pending.length === 0) return;
    // 렌더링 직후 비동기로 처리해 Effect 안의 동기 상태 변경을 피함.
    void Promise.resolve().then(() => pending.forEach((item) => markNotificationRead(item.id)));
  }, [activeRoomLinkPath, markNotificationRead, notifications]);

  const roomIdsKey = useMemo(
    () =>
      chatRooms
        .map((room) => room.id)
        .sort((left, right) => left - right)
        .join(","),
    [chatRooms],
  );

  useEffect(() => {
    activeChatRoomIdRef.current = activeChatRoomId;
  }, [activeChatRoomId]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) {
      roomRef.current = [];
      refreshRequestRef.current = null;
      return;
    }

    void refreshChatRooms().catch(() => undefined);
  }, [accessToken, status, refreshChatRooms]);

  // 로그인 직후 내 상태 설정을 한 번 읽어 둠. 이후 변경은 실시간 이벤트로 갱신되므로 이미 받은 값은 덮지 않음.
  const myMembershipId = member?.membershipId;
  useEffect(() => {
    if (status !== "authenticated" || !accessToken || myMembershipId === undefined) return;
    let cancelled = false;
    addressBookApi
      .myStatus(accessToken)
      .then((result) => {
        if (cancelled) return;
        setMemberStatusByMembershipId((current) =>
          current[myMembershipId]
            ? current
            : {
                ...current,
                [myMembershipId]: {
                  statusType: result.statusType,
                  statusUntil: result.statusUntil,
                },
              },
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, myMembershipId, status]);
  const myStatusType =
    myMembershipId === undefined
      ? null
      : (memberStatusByMembershipId[myMembershipId]?.statusType ?? null);

  // 로그인 직후 최근 30일 알림을 서버에서 불러옴. 토큰이 바뀌거나 로그아웃하면 정리 단계에서 비움.
  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;
    let cancelled = false;
    notificationApi
      .list(accessToken)
      .then((items) => {
        if (!cancelled) setNotifications(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setNotificationsLoaded(true);
      });
    return () => {
      cancelled = true;
      setNotifications([]);
      setNotificationsLoaded(false);
    };
  }, [accessToken, status]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !member) return;

    const connection = connectChatNotification({
      accessToken,
      subscribedChatRoomIds: roomRef.current.map((room) => room.id),
      onMessageCreated: (event) => {
        // 메시지 화면 밖에서도 마지막 메시지 ID를 유지해야 이후 수정·삭제 대상을 구분할 수 있음.
        syncChatRooms(
          roomRef.current.map((target) =>
            target.id === event.chatRoomId && (target.lastMessageId ?? 0) <= event.message.id
              ? {
                  ...target,
                  lastMessageId: event.message.id,
                  lastMessageVersion: event.message.version,
                  lastMessage: event.message.content,
                  lastMessageAt: event.message.createdAt,
                  lastSenderMembershipId: event.message.senderMembershipId,
                }
              : target,
          ),
        );
        const room = roomRef.current.find((target) => target.id === event.chatRoomId);
        const mentioned = event.message.mentionedMembershipIds.includes(member.membershipId);
        // 방별 모드가 MENTION이면 직접 멘션한 메시지만 전역 알림 대상으로 처리.
        if (
          event.message.type !== "TEXT" ||
          !notificationEnabled ||
          (notificationMode === "MENTION" && !mentioned) ||
          event.message.senderMembershipId === member.membershipId ||
          event.chatRoomId === activeChatRoomIdRef.current ||
          !room?.notificationEnabled ||
          (room.notificationMode === "MENTION" && !mentioned)
        ) {
          return;
        }
        const roomName =
          room.type === "DIRECT"
            ? (room.directDisplayName ?? "1:1 메시지")
            : (room.name ?? "그룹 메시지");
        // 패널 목록은 서버 알림 이벤트가 채우고, 여기서는 우측 하단 토스트만 띄움.
        showMessageNotification({
          notificationId: event.message.id,
          chatRoomId: event.chatRoomId,
          roomName,
          senderMembershipId: event.message.senderMembershipId,
          senderName: event.message.senderName,
          content: event.message.content,
          version: event.message.version,
        });
      },
      onMessageChanged: (event) => {
        const incoming = event.message;
        syncChatRooms(
          roomRef.current.map((room) =>
            room.id === event.chatRoomId
              ? applyRoomMessageChange(room, incoming, member.membershipId)
              : room,
          ),
        );
        updateMessageNotification(
          incoming.id,
          incoming.content,
          Boolean(incoming.deletedAt),
          incoming.version,
        );
        // 삭제된 메시지는 안 읽음 집계에서도 빠지므로 서버의 정식 집계로 재동기화.
        if (incoming.deletedAt) void refreshChatRooms().catch(() => undefined);
      },
      onPresenceChanged: (event: PresenceRealtimeEvent) => {
        setPresenceByMembershipId((current) => ({
          ...current,
          [event.membershipId]: event.status,
        }));
        setMemberStatusByMembershipId((current) => ({
          ...current,
          [event.membershipId]: { statusType: event.statusType, statusUntil: event.statusUntil },
        }));
      },
      // 재연결로 같은 알림이 두 번 와도 목록에는 한 번만 남김.
      onNotificationCreated: (event) => {
        setNotifications((current) => [
          event.notification,
          ...current.filter((item) => item.id !== event.notification.id),
        ]);
      },
      // 전역 알림 연결 실패는 일반 화면 이용을 막지 않음.
      onError: () => undefined,
    });

    return () => connection.disconnect();
  }, [
    accessToken,
    member,
    notificationEnabled,
    notificationMode,
    roomIdsKey,
    showMessageNotification,
    status,
    syncChatRooms,
    refreshChatRooms,
    updateMessageNotification,
  ]);

  const value = useMemo(
    () => ({
      notificationCount: status === "authenticated" ? notificationCount : 0,
      notifications,
      notificationsLoaded,
      notificationEnabled,
      notificationMode,
      presenceByMembershipId,
      memberStatusByMembershipId,
      myStatusType,
      activeChatRoomId,
      acknowledgeNotifications,
      markNotificationRead,
      setNotificationEnabled,
      setNotificationMode,
      setActiveChatRoomId,
      syncChatRooms,
      refreshChatRooms,
    }),
    [
      activeChatRoomId,
      acknowledgeNotifications,
      markNotificationRead,
      notificationCount,
      notificationEnabled,
      notificationMode,
      notifications,
      notificationsLoaded,
      presenceByMembershipId,
      memberStatusByMembershipId,
      myStatusType,
      setNotificationEnabled,
      setNotificationMode,
      status,
      syncChatRooms,
      refreshChatRooms,
    ],
  );

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
      {messageNotification && (
        <MessageNotificationToast
          key={messageNotification.id}
          notification={messageNotification}
          senderOnline={presenceByMembershipId[messageNotification.senderMembershipId] === "ONLINE"}
          senderStatusType={
            memberStatusByMembershipId[messageNotification.senderMembershipId]?.statusType ?? null
          }
          onClose={dismissMessageNotification}
          onOpenChatRoom={(notificationId, chatRoomId) => {
            markNotificationRead(notificationId);
            dismissMessageNotification();
            router.push(`/message?roomId=${chatRoomId}`);
          }}
          onDisableNotifications={async (chatRoomId) => {
            if (!accessToken) return;
            // 알림 해제 직후 메모리 방 정보도 갱신해 다음 수신부터 즉시 제외.
            await chatApi.updateNotification(accessToken, chatRoomId, "NONE");
            syncChatRooms(
              roomRef.current.map((room) =>
                room.id === chatRoomId
                  ? { ...room, notificationEnabled: false, notificationMode: "NONE" }
                  : room,
              ),
            );
          }}
        />
      )}
    </ChatNotificationContext.Provider>
  );
}

export function useChatNotification() {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    throw new Error(
      "useChatNotification은 ChatNotificationProvider 내부에서만 사용할 수 있습니다.",
    );
  }
  return context;
}
