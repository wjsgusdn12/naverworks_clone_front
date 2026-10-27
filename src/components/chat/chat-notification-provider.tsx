"use client";

import { MessageNotificationToast } from "@/components/common/message-notification-toast";
import { useAuth } from "@/components/auth/auth-provider";
import {
  chatApi,
  type ChatRoom,
} from "@/lib/api/chat-api";
import {
  connectChatNotification,
  type PresenceRealtimeEvent,
} from "@/lib/realtime/chat-realtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMessageNotificationToast } from "@/hooks/use-message-notification-toast";
import { useRouter } from "next/navigation";
import { applyRoomMessageChange } from "@/lib/chat-message-state";

type ChatNotificationContextValue = {
  notificationCount: number;
  notifications: ChatNotificationItem[];
  notificationEnabled: boolean;
  notificationMode: "ALL" | "MENTION" | "NONE";
  presenceByMembershipId: Record<number, boolean>;
  activeChatRoomId: number | null;
  acknowledgeNotifications: () => void;
  markNotificationRead: (notificationId: number) => void;
  setNotificationEnabled: (enabled: boolean) => void;
  setNotificationMode: (mode: "ALL" | "MENTION" | "NONE") => void;
  setActiveChatRoomId: (chatRoomId: number | null) => void;
  syncChatRooms: (rooms: ChatRoom[]) => void;
  refreshChatRooms: () => Promise<ChatRoom[]>;
};

export type ChatNotificationItem = {
  id: number;
  chatRoomId: number;
  roomName: string;
  senderName: string;
  content: string;
  createdAt: string;
  read: boolean;
  mentioned: boolean;
  version: number;
};

const ChatNotificationContext = createContext<ChatNotificationContextValue | null>(null);

export function ChatNotificationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { accessToken, member, status } = useAuth();
  const [notifications, setNotifications] = useState<ChatNotificationItem[]>([]);
  const [notificationMode, setNotificationModeState] = useState<"ALL" | "MENTION" | "NONE">(() => {
    if (typeof window === "undefined") return "ALL";
    const stored = window.localStorage.getItem("naverworks:notificationMode");
    return stored === "MENTION" || stored === "NONE" ? stored : "ALL";
  });
  const [activeChatRoomId, setActiveChatRoomId] = useState<number | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [presenceByMembershipId, setPresenceByMembershipId] = useState<Record<number, boolean>>({});
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
    const promise = chatApi.rooms(accessToken).then((result) => {
      if (refreshRequestRef.current?.token === accessToken) syncChatRooms(result);
      return result;
    }).finally(() => {
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

  const acknowledgeNotifications = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const markNotificationRead = useCallback((notificationId: number) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item,
      ),
    );
  }, []);

  const notificationCount = notifications.filter((item) => !item.read).length;

  const roomIdsKey = useMemo(
    () => chatRooms.map((room) => room.id).sort((left, right) => left - right).join(","),
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

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !member) return;

    const connection = connectChatNotification({
      accessToken,
      subscribedChatRoomIds: roomRef.current.map((room) => room.id),
      onMessageCreated: (event) => {
        // 메시지 화면 밖에서도 마지막 메시지 ID를 유지해야 이후 수정·삭제 대상을 구분할 수 있음.
        syncChatRooms(roomRef.current.map((target) => target.id === event.chatRoomId && (target.lastMessageId ?? 0) <= event.message.id
          ? { ...target, lastMessageId: event.message.id, lastMessageVersion: event.message.version, lastMessage: event.message.content, lastMessageAt: event.message.createdAt, lastSenderMembershipId: event.message.senderMembershipId }
          : target));
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
        const roomName = room.type === "DIRECT"
          ? room.directDisplayName ?? "1:1 메시지"
          : room.name ?? "그룹 메시지";
        const notification = {
          id: event.message.id,
          chatRoomId: event.chatRoomId,
          roomName,
          senderName: event.message.senderName,
          content: event.message.content,
          createdAt: event.message.createdAt,
          read: false,
          mentioned,
          version: event.message.version,
        };
        // 동일 메시지가 재전송되어도 알림 목록에는 한 번만 남김.
        setNotifications((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, 50));
        showMessageNotification({
          notificationId: notification.id,
          chatRoomId: event.chatRoomId,
          roomName,
          senderName: event.message.senderName,
          content: event.message.content,
          version: event.message.version,
        });
      },
      onMessageChanged: (event) => {
        const incoming = event.message;
        syncChatRooms(roomRef.current.map((room) => room.id === event.chatRoomId
          ? applyRoomMessageChange(room, incoming, member.membershipId) : room));
        setNotifications((current) => incoming.deletedAt
          ? current.filter((item) => item.id !== incoming.id)
          : current.map((item) => item.id === incoming.id && (item.version ?? 0) <= incoming.version
            ? { ...item, content: incoming.content, mentioned: incoming.mentionedMembershipIds.includes(member.membershipId), version: incoming.version }
            : item));
        updateMessageNotification(incoming.id, incoming.content, Boolean(incoming.deletedAt), incoming.version);
        // 삭제된 메시지는 안 읽음 집계에서도 빠지므로 서버의 정식 집계로 재동기화.
        if (incoming.deletedAt) void refreshChatRooms().catch(() => undefined);
      },
      onPresenceChanged: (event: PresenceRealtimeEvent) => {
        setPresenceByMembershipId((current) => ({
          ...current,
          [event.membershipId]: event.online,
        }));
      },
      // 전역 알림 연결 실패는 일반 화면 이용을 막지 않음.
      onError: () => undefined,
    });

    return () => connection.disconnect();
  }, [accessToken, member, notificationEnabled, notificationMode, roomIdsKey, showMessageNotification, status, syncChatRooms, refreshChatRooms, updateMessageNotification]);

  const value = useMemo(
    () => ({
      notificationCount: status === "authenticated" ? notificationCount : 0,
      notifications,
      notificationEnabled,
      notificationMode,
      presenceByMembershipId,
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
      presenceByMembershipId,
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
    throw new Error("useChatNotification은 ChatNotificationProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
