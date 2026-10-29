import type { ChatRoom } from "@/lib/api/chat-api";

// 마지막 대화가 있는 방은 그 시각, 새 방은 생성 시각을 기준으로 최신순을 유지.
export const sortRoomsByLatestActivity = (rooms: ChatRoom[]) =>
  [...rooms].sort((left, right) => {
    // 고정한 방은 최근 활동 시각보다 항상 먼저 보여 줌.
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned)
      return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftTime = new Date(left.lastMessageAt ?? left.createdAt).getTime();
    const rightTime = new Date(right.lastMessageAt ?? right.createdAt).getTime();
    return rightTime - leftTime;
  });

export type RoomSort = "LATEST" | "TYPE" | "UNREAD";

export const sortRooms = (rooms: ChatRoom[], sort: RoomSort) => {
  if (sort !== "UNREAD") return sortRoomsByLatestActivity(rooms);
  return [...rooms].sort((left, right) => {
    // 안 읽은 메시지 정렬에서도 고정한 방이 최우선.
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned)
      return new Date(left.pinnedAt ?? 0).getTime() - new Date(right.pinnedAt ?? 0).getTime();
    const leftHasUnread = left.unreadCount > 0;
    const rightHasUnread = right.unreadCount > 0;
    if (leftHasUnread !== rightHasUnread) return leftHasUnread ? -1 : 1;
    if (leftHasUnread && rightHasUnread) {
      // 첫 미확인 메시지가 더 오래된 방부터 확인하도록 오름차순 정렬.
      return (
        new Date(left.oldestUnreadMessageAt ?? left.lastMessageAt ?? left.createdAt).getTime() -
        new Date(right.oldestUnreadMessageAt ?? right.lastMessageAt ?? right.createdAt).getTime()
      );
    }
    return (
      new Date(right.lastMessageAt ?? right.createdAt).getTime() -
      new Date(left.lastMessageAt ?? left.createdAt).getTime()
    );
  });
};
