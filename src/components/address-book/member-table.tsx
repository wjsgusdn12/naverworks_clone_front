"use client";

import { CustomCheckbox } from "@/components/address-book/custom-checkbox";
import { FavoriteButton } from "@/components/address-book/favorite-button";
import { MemberAvatar } from "@/components/address-book/member-avatar";
import type { AddressBookMember } from "@/lib/api/address-book-api";

export function MemberTable({
  members,
  selectedMemberId,
  selectedMemberIds,
  sort,
  direction,
  onSort,
  onSelectMember,
  onToggleFavorite,
  onToggleSelection,
}: {
  members: AddressBookMember[];
  selectedMemberId: number | null;
  selectedMemberIds: number[];
  sort: string;
  direction: string;
  onSort: (key: string) => void;
  onSelectMember: (member: AddressBookMember) => void;
  onToggleFavorite: (member: AddressBookMember) => void;
  onToggleSelection: (membershipId: number) => void;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="border-b border-slate-200 bg-white text-slate-700">
          <tr>
            <th className="w-11 px-3 py-3" />
            {[
              ["name", "이름"],
              ["jobGrade", "직책/직급"],
              ["department", "부서"],
              ["company", "소속"],
              ["email", "이메일"],
              ["phone", "전화번호"],
            ].map(([key, label]) => (
              <th key={key} className="px-4 py-3 font-semibold">
                <button className="cursor-pointer hover:text-blue-600" onClick={() => onSort(key)}>
                  {label}
                  {sort === key ? (direction === "asc" ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((target) => (
            <tr
              key={target.membershipId}
              className={`cursor-pointer border-b border-slate-100 transition hover:bg-blue-50 ${selectedMemberId === target.membershipId ? "bg-blue-50" : ""}`}
              onClick={() => onSelectMember(target)}
            >
              <td className="px-3 py-3">
                <span onClick={(event) => event.stopPropagation()}>
                  <CustomCheckbox
                    label={`${target.displayName} 선택`}
                    checked={selectedMemberIds.includes(target.membershipId)}
                    onChange={() => onToggleSelection(target.membershipId)}
                  />
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    <FavoriteButton
                      active={target.favorite}
                      onClick={() => onToggleFavorite(target)}
                    />
                  </span>
                  <MemberAvatar member={target} />
                  <b>{target.displayName}</b>
                </div>
              </td>
              <td className="px-4 py-3">
                {[target.jobTitle, target.jobGradeName].filter(Boolean).join(" / ") || "-"}
              </td>
              <td className="px-4 py-3">{target.departmentName ?? "-"}</td>
              <td className="px-4 py-3">{target.companyName}</td>
              <td className="px-4 py-3">{target.email}</td>
              <td className="px-4 py-3">{target.phoneNumber ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {members.length === 0 && (
        <p className="p-12 text-center text-sm text-slate-500">표시할 구성원이 없습니다.</p>
      )}
    </div>
  );
}
