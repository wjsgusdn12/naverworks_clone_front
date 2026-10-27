import { Bell, BellOff, MessageCircle, X } from "lucide-react";
import type { MessageNotificationToastState } from "@/hooks/use-message-notification-toast";
import { useState } from "react";

type MessageNotificationToastProps = {
  notification: MessageNotificationToastState;
  onClose: () => void;
  onOpenChatRoom: (notificationId: number, chatRoomId: number) => void;
  onDisableNotifications: (chatRoomId: number) => Promise<void>;
};

// 새 메시지만 우측 하단 카드로 보여 일반 안내 토스트와 목적을 구분.
export function MessageNotificationToast({
  notification,
  onClose,
  onOpenChatRoom,
  onDisableNotifications,
}: MessageNotificationToastProps) {
  const [isNotificationDisabled, setIsNotificationDisabled] = useState(false);
  const animationClassName =
    notification.phase === "exit"
      ? "message-notification-exit"
      : "message-notification-enter";

  const disableRoomNotifications = async () => {
    if (isNotificationDisabled) return;
    setIsNotificationDisabled(true);
    try {
      await onDisableNotifications(notification.chatRoomId);
      // OFF 아이콘 전환을 짧게 보여 준 뒤 카드가 퇴장.
      window.setTimeout(onClose, 360);
    } catch {
      setIsNotificationDisabled(false);
    }
  };

  return (
    <aside
      role="button"
      tabIndex={0}
      aria-live="polite"
      aria-label={`${notification.roomName} 메시지방으로 이동`}
      onClick={() => onOpenChatRoom(notification.notificationId, notification.chatRoomId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenChatRoom(notification.notificationId, notification.chatRoomId);
        }
      }}
      className={`fixed bottom-6 right-6 z-[100] w-[calc(100%-2rem)] max-w-sm cursor-pointer rounded-md border border-slate-200 bg-white p-4 text-slate-900 shadow-xl outline-none transition-all duration-300 hover:border-blue-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 ${animationClassName}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <MessageCircle size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{notification.roomName}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {notification.senderName}
          </p>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-500">
            {notification.content}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${notification.roomName} 알림 해제`}
            onClick={(event) => {
              event.stopPropagation();
              void disableRoomNotifications();
            }}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition active:scale-95 ${isNotificationDisabled ? "text-slate-400" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"}`}
          >
            {isNotificationDisabled ? (
              <BellOff size={17} className="notification-bell-off" aria-hidden="true" />
            ) : (
              <Bell size={17} className="notification-bell-on" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="메시지 알림 닫기"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
