"use client";

import type { PresenceStatus } from "@/lib/api/address-book-api";
import { UserAvatar } from "@/components/common/user-avatar";

// 메시지 화면용 얇은 포장. 실제 그림은 공통 UserAvatar가 담당. md·lg 모두 40px 크기.
export function MessageMemberAvatar({
  name,
  presenceStatus,
  onClick,
}: {
  name: string;
  presenceStatus: PresenceStatus;
  size?: "md" | "lg";
  onClick?: () => void;
}) {
  return (
    <UserAvatar
      name={name}
      presenceStatus={presenceStatus}
      size="md"
      onClick={onClick}
      dataName={name}
    />
  );
}
