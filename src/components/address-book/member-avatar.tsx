import type { AddressBookMember, AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { X } from "lucide-react";

const statusClassName = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-slate-300",
  AWAY: "bg-slate-500 text-white",
  INACTIVE: "bg-red-500 text-white",
} as const;

export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: AddressBookMember | AddressBookMemberDetail;
  size?: "sm" | "lg";
}) {
  const isLarge = size === "lg";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-800 ${isLarge ? "h-16 w-16 text-lg" : "h-8 w-8 text-[10px]"}`}
    >
      <span className="whitespace-nowrap">{member.displayName.slice(0, 3)}</span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-white ${isLarge ? "h-5 w-5" : "h-3.5 w-3.5"} ${statusClassName[member.presenceStatus]}`}
      >
        {(member.presenceStatus === "AWAY" || member.presenceStatus === "INACTIVE") && (
          <X size={isLarge ? 13 : 9} strokeWidth={3} />
        )}
      </span>
    </span>
  );
}
