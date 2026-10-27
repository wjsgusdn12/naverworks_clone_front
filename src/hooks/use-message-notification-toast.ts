"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DISPLAY_DURATION_MS = 6_000;
const EXIT_DURATION_MS = 250;

export type MessageNotification = {
  notificationId: number;
  chatRoomId: number;
  roomName: string;
  senderName: string;
  content: string;
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

  return {
    messageNotification,
    showMessageNotification,
    dismissMessageNotification,
  };
}
