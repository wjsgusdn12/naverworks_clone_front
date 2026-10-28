"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DISPLAY_DURATION_MS = 6_000;
const EXIT_DURATION_MS = 250;

export type MessageNotification = {
  notificationId: number;
  chatRoomId: number;
  roomName: string;
  senderMembershipId: number;
  senderName: string;
  content: string;
  version?: number;
};

export type MessageNotificationToastState = MessageNotification & {
  id: number;
  phase: "enter" | "replay" | "exit";
};

// 일반 안내와 분리해 메시지 수신 정보가 있는 알림 카드만 관리.
export function useMessageNotificationToast() {
  const [messageNotification, setMessageNotification] =
    useState<MessageNotificationToastState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    hideTimerRef.current = null;
    removeTimerRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const showMessageNotification = useCallback(
    (notification: MessageNotification) => {
      clearTimers();
      const id = ++sequenceRef.current;
      setMessageNotification((current) => ({
        ...notification,
        id,
        phase: current ? "replay" : "enter",
      }));
      hideTimerRef.current = setTimeout(() => {
        setMessageNotification((current) =>
          current?.id === id ? { ...current, phase: "exit" } : current,
        );
      }, DISPLAY_DURATION_MS - EXIT_DURATION_MS);
      removeTimerRef.current = setTimeout(() => {
        setMessageNotification((current) => (current?.id === id ? null : current));
      }, DISPLAY_DURATION_MS);
    },
    [clearTimers],
  );

  const dismissMessageNotification = useCallback(() => {
    clearTimers();
    setMessageNotification((current) => {
      if (!current) return null;
      const id = current.id;
      removeTimerRef.current = setTimeout(() => {
        setMessageNotification((active) => (active?.id === id ? null : active));
      }, EXIT_DURATION_MS);
      return { ...current, phase: "exit" };
    });
  }, [clearTimers]);

  // 이미 표시 중인 알림만 갱신하며, 수정·삭제로 새 알림을 만들지는 않음.
  const updateMessageNotification = useCallback((messageId: number, content: string, deleted: boolean, version: number) => {
    setMessageNotification((current) => current?.notificationId === messageId && (current.version ?? 0) <= version
      ? (deleted ? null : { ...current, content, version }) : current);
  }, []);

  return {
    messageNotification,
    showMessageNotification,
    dismissMessageNotification,
    updateMessageNotification,
  };
}
