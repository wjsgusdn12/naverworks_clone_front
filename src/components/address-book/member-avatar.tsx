import type { AddressBookMember, AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { UserAvatar } from "@/components/common/user-avatar";

// 주소록용 얇은 포장. 실제 그림은 공통 UserAvatar가 담당.
export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: AddressBookMember | AddressBookMemberDetail;
  size?: "sm" | "lg";
}) {
  return (
    <UserAvatar
      name={member.displayName}
      presenceStatus={member.presenceStatus}
      statusType={member.statusType}
      size={size}
    />
  );
}
