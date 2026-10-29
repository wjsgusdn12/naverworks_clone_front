import type { MemberStatus, PresenceStatus } from "@/lib/api/address-book-api";

// REST로 받은 구성원 정보 위에 WebSocket의 최신 접속 상태·상태 설정을 덮음.
// 비활성 계정(INACTIVE)은 실시간 이벤트와 무관하게 그대로 둠.
export const withLiveStatus = <
  T extends MemberStatus & { membershipId: number; presenceStatus: PresenceStatus },
>(
  member: T,
  presenceByMembershipId: Record<number, PresenceStatus>,
  memberStatusByMembershipId: Record<number, MemberStatus>,
): T => {
  if (member.presenceStatus === "INACTIVE") return member;
  const presence = presenceByMembershipId[member.membershipId];
  const status = memberStatusByMembershipId[member.membershipId];
  if (presence === undefined && status === undefined) return member;
  return {
    ...member,
    presenceStatus: presence ?? member.presenceStatus,
    statusType: status ? status.statusType : member.statusType,
    statusUntil: status ? status.statusUntil : member.statusUntil,
  };
};
