"use client";

import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { CheckboxControl } from "@/components/common/custom-checkbox";
import { LoadingState } from "@/components/common/loading";
import { Tabs } from "@/components/common/tabs";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import { withLiveStatus } from "@/lib/live-status";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function NewRoomModal({
  members: rawMembers,
  membersLoaded = true,
  initialMemberIds,
  initialType,
  onClose,
  onCreate,
  onSelf,
  onProfileClick,
  showToast,
}: {
  members: AddressBookMember[];
  // 구성원 목록을 받아 왔는지. 받기 전에는 목록 자리에 로딩 표시.
  membersLoaded?: boolean;
  initialMemberIds: number[];
  initialType: "DIRECT" | "GROUP";
  onClose: () => void;
  onCreate: (type: "DIRECT" | "GROUP", name: string, memberIds: number[]) => Promise<void>;
  onSelf: () => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  showToast: (message: string) => void;
}) {
  // 실시간 접속 상태·상태 설정을 덮어 아바타 배지가 다른 화면과 같게 보이도록 함.
  const { presenceByMembershipId, memberStatusByMembershipId } = useChatNotification();
  const members = rawMembers.map((member) =>
    withLiveStatus(member, presenceByMembershipId, memberStatusByMembershipId),
  );
  const [type, setType] = useState<"DIRECT" | "GROUP">(initialType);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(initialMemberIds);
  const [keyword, setKeyword] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (event.target === ref.current) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const visibleMembers = members.filter((member) =>
    `${member.displayName} ${member.email} ${member.companyName} ${member.departmentName ?? ""} ${member.jobGradeName ?? ""}`
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );
  const toggleMember = (membershipId: number) =>
    setSelectedIds((current) =>
      type === "DIRECT"
        ? [membershipId]
        : current.includes(membershipId)
          ? current.filter((id) => id !== membershipId)
          : [...current, membershipId],
    );
  const submit = async () => {
    if (type === "DIRECT" && selectedIds.length !== 1) {
      showToast("1:1 메시지 상대를 한 명 선택해 주세요.");
      return;
    }
    if (type === "GROUP" && !name.trim()) {
      showToast("그룹명을 입력해 주세요.");
      return;
    }
    if (type === "GROUP" && selectedIds.length < 2) {
      showToast("그룹 메시지는 나를 포함해 3명 이상이어야 합니다.");
      return;
    }
    try {
      await onCreate(type, name.trim(), selectedIds);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지방을 만들지 못했습니다.");
    }
  };
  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 높이 고정: 탭을 바꾸거나 구성원 수가 달라도 모달 크기는 그대로, 구성원 목록만 안에서 스크롤. */}
      <section className="flex h-[min(680px,calc(100dvh-2rem))] w-full max-w-lg animate-in fade-in zoom-in-95 flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">새 메시지</h2>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="cursor-pointer p-1 text-slate-500 hover:text-slate-900"
          >
            <X />
          </button>
        </div>
        <button
          onClick={() => void onSelf()}
          className="mt-4 w-full cursor-pointer rounded-lg border border-slate-200 py-2 text-sm transition hover:bg-slate-50"
        >
          나와의 채팅
        </button>
        <Tabs
          className="mt-5"
          items={[
            { key: "DIRECT" as const, label: "1:1 메시지" },
            { key: "GROUP" as const, label: "그룹 메시지" },
          ]}
          value={type}
          onChange={(next) => {
            setType(next);
            setSelectedIds([]);
          }}
          ariaLabel="메시지방 종류"
        />
        {type === "GROUP" && (
          <label className="mt-4 block text-sm font-medium">
            그룹명
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"
              placeholder="그룹명을 입력하세요"
            />
          </label>
        )}
        <label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
          <Search size={17} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="w-full text-sm outline-none"
            placeholder="구성원 검색"
          />
        </label>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200">
          {!membersLoaded && (
            <LoadingState message="구성원을 불러오는 중입니다." className="py-8" />
          )}
          {membersLoaded && visibleMembers.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">표시할 구성원이 없습니다.</p>
          )}
          {visibleMembers.map((member) => {
            const selected = selectedIds.includes(member.membershipId);
            return (
              <button
                key={member.membershipId}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggleMember(member.membershipId)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${selected ? "bg-blue-50" : ""}`}
              >
                <MessageMemberAvatar
                  name={member.displayName}
                  presenceStatus={member.presenceStatus}
                  statusType={member.statusType}
                  onClick={() => onProfileClick(member.membershipId)}
                />
                <span className="min-w-0 flex-1">
                  <b className="block text-sm">{member.displayName}</b>
                  <small className="block truncate text-slate-500">
                    {[
                      member.companyName,
                      member.departmentName ?? "부서 미지정",
                      member.jobGradeName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {member.email}
                  </small>
                </span>
                <CheckboxControl checked={selected} />
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {type === "GROUP" ? `선택 ${selectedIds.length}명 + 나` : `선택 ${selectedIds.length}명`}
        </p>
        <button
          onClick={() => void submit()}
          className="mt-5 h-11 w-full shrink-0 cursor-pointer rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[.98]"
        >
          메시지방 만들기
        </button>
      </section>
    </div>
  );
}
