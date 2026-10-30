"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import type { PresenceStatus } from "@/lib/api/address-book-api";
import type { MemberStatusType } from "@/lib/status-options";

type BadgeSource = { presenceStatus: PresenceStatus; statusType: MemberStatusType | null };

// 구성원 ID로 공통 아바타 배지 값(접속 상태·상태 설정)을 구함.
// - 본인: 접속 중이므로 온라인 + 내 상태 설정.
// - 다른 사람: 주소록 프로필 위에 실시간 이벤트 값을 덮음. 비활성 계정은 그대로.
export function useMemberBadge(profileById: Map<number, BadgeSource>) {
  const { member } = useAuth();
  const { presenceByMembershipId, memberStatusByMembershipId, myStatusType } =
    useChatNotification();
  const myMembershipId = member?.membershipId;
  return useCallback(
    (membershipId: number): BadgeSource => {
      if (membershipId === myMembershipId) {
        return { presenceStatus: "ONLINE", statusType: myStatusType };
      }
      const profile = profileById.get(membershipId);
      if (profile?.presenceStatus === "INACTIVE") return profile;
      const liveStatus = memberStatusByMembershipId[membershipId];
      return {
        presenceStatus:
          presenceByMembershipId[membershipId] ?? profile?.presenceStatus ?? "OFFLINE",
        statusType: liveStatus ? liveStatus.statusType : (profile?.statusType ?? null),
      };
    },
    [memberStatusByMembershipId, myMembershipId, myStatusType, presenceByMembershipId, profileById],
  );
}
