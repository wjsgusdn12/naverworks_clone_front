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
  const activeChatRoomIdRef = useRef<number | null>(null);
  const {
    messageNotification,
    showMessageNotification,
    dismissMessageNotification,
  } = useMessageNotificationToast();

  const syncChatRooms = useCallback((rooms: ChatRoom[]) => {
    roomRef.current = rooms;
    setChatRooms(rooms);
  }, []);

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
      return;
    }

    void chatApi.rooms(accessToken)
      .then(syncChatRooms)
      .catch(() => undefined);
  }, [accessToken, status, syncChatRooms]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !member) return;

    const connection = connectChatNotification({
      accessToken,
      subscribedChatRoomIds: roomRef.current.map((room) => room.id),
      onMessageCreated: (event) => {
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
        });
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
  }, [accessToken, member, notificationEnabled, notificationMode, roomIdsKey, showMessageNotification, status]);

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
