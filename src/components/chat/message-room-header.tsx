"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { MeBadge } from "@/components/common/me-badge";
import type { PresenceStatus } from "@/lib/api/address-book-api";
import type { ChatRoom } from "@/lib/api/chat-api";

// 선택한 방의 상단 헤더. 그룹방은 상세 패널 토글 버튼, 1:1·나와의 채팅은 프로필 표시.
export function MessageRoomHeader({
  selectedRoom,
  roomManageOpen,
  onToggleRoomManage,
  displayRoomName,
  headerProfile,
  directPresenceStatus,
  headerMembershipId,
  onProfileClick,
}: {
  selectedRoom: ChatRoom | null;
  roomManageOpen: boolean;
  onToggleRoomManage: () => void;
  displayRoomName: (room: ChatRoom) => string;
  headerProfile: {
    displayName: string;
    jobGradeName: string;
    departmentName: string;
    companyName: string;
  } | null;
  directPresenceStatus: PresenceStatus | undefined;
  headerMembershipId: number | null | undefined;
  onProfileClick: (membershipId: number) => void;
}) {
  return (
    <header className="border-b border-slate-200 px-6">
      <div className="flex h-20 items-center justify-between">
        {selectedRoom?.type === "GROUP" ? (
          <button
            type="button"
            aria-expanded={roomManageOpen}
            aria-label="그룹 메시지 상세 열기"
            onClick={onToggleRoomManage}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-slate-50 active:scale-[.99]"
          >
            <GroupAvatar name={displayRoomName(selectedRoom)} size="lg" />
            <div>
              <h1 className="font-bold">{displayRoomName(selectedRoom)}</h1>
              <p className="mt-1 text-sm text-slate-500">
                멤버{" "}
                <span className="text-base font-extrabold text-blue-600">
                  {selectedRoom.memberCount}
                </span>
              </p>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <MessageMemberAvatar
              name={headerProfile?.displayName ?? ""}
              presenceStatus={
                selectedRoom?.type === "SELF" ? "ONLINE" : (directPresenceStatus ?? "OFFLINE")
              }
              size="lg"
              onClick={headerMembershipId ? () => onProfileClick(headerMembershipId) : undefined}
            />
            <div>
              <h1 className="flex items-center gap-1 font-bold">
                {selectedRoom?.type === "SELF" && <MeBadge />}
                {headerProfile?.displayName ?? "메시지"}
              </h1>
              <p className="mt-1 text-xs">
                <span className="text-blue-600">{headerProfile?.jobGradeName}</span>
                <span className="text-slate-500">
                  {headerProfile?.departmentName && ` · ${headerProfile.departmentName}`}
                  {headerProfile?.companyName && ` · ${headerProfile.companyName}`}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
