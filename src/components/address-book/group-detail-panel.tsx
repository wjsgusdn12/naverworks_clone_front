"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { FavoriteBadge } from "@/components/address-book/favorite-badge";
import { LoadingInline } from "@/components/common/loading";
import { MeBadge } from "@/components/common/me-badge";
import type { ChatGroupMember, ChatGroupSummary } from "@/lib/api/chat-api";
import { CalendarDays, Mail, MessageCircle, X } from "lucide-react";
import { useState } from "react";

// 그룹 상세 패널. 구성원 상세와 같은 틀에 그룹 이름·인원수, 그룹멤버/그룹마스터 탭을 둠.
type GroupDetailTab = "member" | "owner";
const GROUP_MEMBER_STEP = 5;

export function GroupDetailPanel({
  group,
  members,
  myMembershipId,
  onClose,
  onSelectMember,
  onMessage,
  showToast,
}: {
  group: ChatGroupSummary;
  members: ChatGroupMember[] | null;
  // 본인 줄에 "나" 딱지를 붙이기 위한 로그인 사용자 ID.
  myMembershipId: number;
  onClose: () => void;
  onSelectMember: (member: ChatGroupMember) => void;
  onMessage: () => void;
  showToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<GroupDetailTab>("member");
  // "더 보기"를 누른 횟수. 그룹이 바뀌면 처음 5명부터 다시 보이도록 그룹 ID와 함께 저장.
  const [expandState, setExpandState] = useState({ groupId: 0, steps: 1 });
  const steps = expandState.groupId === group.id ? expandState.steps : 1;

  const list = (members ?? []).filter((member) => (tab === "owner" ? member.owner : true));
  const shown = tab === "member" ? list.slice(0, steps * GROUP_MEMBER_STEP) : list;

  return (
    <aside className="relative w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <div className="flex justify-end">
        <button
          aria-label="상세 패널 닫기"
          className="cursor-pointer rounded-md p-0 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <GroupAvatar name={group.name || "그룹"} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{group.name || "이름 없는 그룹"}</h2>
          <p className="text-sm text-slate-500">멤버 {group.memberCount}명</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-blue-600">
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={onMessage}
        >
          <MessageCircle className="mx-auto mb-1" size={20} />
          메시지
        </button>
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={() => showToast("메일 기능은 준비 중입니다.")}
        >
          <Mail className="mx-auto mb-1" size={20} />
          메일
        </button>
        <button
          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 active:scale-95"
          onClick={() => showToast("캘린더 기능은 준비 중입니다.")}
        >
          <CalendarDays className="mx-auto mb-1" size={20} />
          캘린더
        </button>
      </div>
      <div className="mt-6 flex gap-4 border-b border-slate-200" role="tablist">
        {(
          [
            ["member", "그룹멤버"],
            ["owner", "그룹마스터"],
          ] as [GroupDetailTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`cursor-pointer border-b-2 px-1 pb-2 text-sm transition ${tab === key ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {members === null ? (
        <LoadingInline message="구성원을 불러오는 중입니다." className="py-8 text-sm" />
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {tab === "owner" ? "방장이 없는 그룹입니다." : "구성원이 없습니다."}
        </p>
      ) : (
        <ul className="mt-2">
          {shown.map((member) => (
            <li key={member.membershipId}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                onClick={() => onSelectMember(member)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-800">
                  {member.displayName.slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {member.membershipId === myMembershipId && <MeBadge />}
                    <b className="truncate text-sm text-slate-900">{member.displayName}</b>
                    {member.favorite && <FavoriteBadge />}
                    {member.owner && (
                      <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        마스터
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[
                      member.jobGradeName ?? member.jobTitle,
                      member.departmentName,
                      member.companyName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {tab === "member" && shown.length < list.length && (
            <li>
              <button
                type="button"
                className="mt-1 w-full cursor-pointer rounded-lg py-2 text-center text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setExpandState({ groupId: group.id, steps: steps + 1 })}
              >
                더 보기 ({shown.length}/{list.length})
              </button>
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}
