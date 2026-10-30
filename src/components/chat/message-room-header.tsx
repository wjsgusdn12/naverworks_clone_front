"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { MeBadge } from "@/components/common/me-badge";
import { Tooltip } from "@/components/common/tooltip";
import { Images } from "lucide-react";
import type { PresenceStatus } from "@/lib/api/address-book-api";
import type { ChatRoom } from "@/lib/api/chat-api";
import type { MemberStatusType } from "@/lib/status-options";

// 선택한 방의 상단 헤더. 그룹방은 상세 패널 토글 버튼, 1:1·나와의 채팅은 프로필 표시.
export function MessageRoomHeader({
  selectedRoom,
  roomManageOpen,
  onToggleRoomManage,
  displayRoomName,
  headerProfile,
  directPresenceStatus,
  directStatusType,
  headerMembershipId,
  onProfileClick,
  galleryOpen,
  onToggleGallery,
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
  directStatusType?: MemberStatusType | null;
  headerMembershipId: number | null | undefined;
  onProfileClick: (membershipId: number) => void;
  // 오른쪽 "사진·파일" 버튼으로 모아보기 패널을 열고 닫음(모든 방 종류 공통).
  galleryOpen: boolean;
  onToggleGallery: () => void;
}) {
  // 본인 아바타 배지에 쓰는 내 상태 설정.
  const { myStatusType } = useChatNotification();
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
              statusType={selectedRoom?.type === "SELF" ? myStatusType : directStatusType}
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
        {selectedRoom && (
          <Tooltip label="주고받은 사진·파일 모아보기">
            <button
              type="button"
              aria-expanded={galleryOpen}
              onClick={onToggleGallery}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-95 ${galleryOpen ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              <Images size={18} aria-hidden="true" />
              사진·파일
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
