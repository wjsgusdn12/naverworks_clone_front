"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { MessageMemberAvatar } from "@/components/chat/message-member-avatar";
import { LoadingState } from "@/components/common/loading";
import type { AddressBookMember } from "@/lib/api/address-book-api";
import { chatApi, type ChatMemberProfile, type ChatRoom } from "@/lib/api/chat-api";
import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function GroupRoomDetail({
  room,
  accessToken,
  currentMemberId,
  members,
  onClose,
  onAction,
  onReloadMessages,
  onProfileClick,
  showToast,
}: {
  room: ChatRoom;
  accessToken: string;
  currentMemberId: number;
  members: AddressBookMember[];
  onClose: () => void;
  onAction: (
    action: "leave" | "invite" | "remove" | "owner" | "rename",
    targetId?: number,
    name?: string,
  ) => Promise<void>;
  onReloadMessages: () => Promise<void>;
  onProfileClick: (membershipId: number) => void;
  showToast: (message: string) => void;
}) {
  const [name, setName] = useState(room.name ?? "");
  const [inviteId, setInviteId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [participants, setParticipants] = useState<ChatMemberProfile[]>([]);
  const inviteRef = useRef<HTMLDivElement>(null);
  const owner = room.ownerMembershipId === currentMemberId;
  // 전체 회사 구성원 중 현재 방에 없는 사람만 초대 후보로 제공.
  const inviteCandidates = members.filter(
    (member) =>
      !participants.some((participant) => participant.membershipId === member.membershipId),
  );
  const selectedInvite =
    inviteCandidates.find((member) => member.membershipId === inviteId) ?? null;

  const refreshParticipants = useCallback(async () => {
    const detail = await chatApi.detail(accessToken, room.id);
    setParticipants(detail.members);
  }, [accessToken, room.id]);

  useEffect(() => {
    void Promise.resolve()
      .then(refreshParticipants)
      .catch((error: Error) => showToast(error.message));
  }, [refreshParticipants, showToast]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(event.target as Node))
        setInviteOpen(false);
    };
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inviteOpen) setInviteOpen(false);
      else onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeByEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeByEscape);
    };
  }, [inviteOpen, onClose]);

  const run = async (
    action: "leave" | "invite" | "remove" | "owner" | "rename",
    targetId?: number,
  ) => {
    try {
      if (action === "rename" && !name.trim()) {
        showToast("그룹명을 입력해 주세요.");
        return;
      }
      if (action === "invite" && !inviteId) {
        showToast("초대할 구성원을 선택해 주세요.");
        return;
      }
      await onAction(action, targetId ?? inviteId ?? undefined, name);
      if (action === "invite") {
        await Promise.all([refreshParticipants(), onReloadMessages()]);
        setInviteId(null);
        setInviteOpen(false);
        showToast("구성원을 초대했습니다.");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
    }
  };

  return (
    <aside className="h-full w-[min(420px,40vw)] shrink-0 animate-in slide-in-from-right overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GroupAvatar name={room.name ?? "그룹"} size="lg" />
          <div>
            <b className="block">{room.name}</b>
            <p className="mt-1 text-sm text-slate-500">
              멤버{" "}
              <span className="font-bold text-blue-600">
                {participants.length || room.memberCount}
              </span>
            </p>
          </div>
        </div>
        <button
          aria-label="그룹 메시지 상세 닫기"
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-slate-500 transition hover:bg-slate-100"
        >
          <X />
        </button>
      </div>
      {owner && (
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
          <label className="text-sm font-medium">
            그룹명
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"
            />
          </label>
          <button
            onClick={() => void run("rename")}
            className="h-9 cursor-pointer rounded-lg border border-blue-200 px-3 text-sm text-blue-700 transition hover:bg-blue-50"
          >
            변경
          </button>
          <div ref={inviteRef} className="relative">
            <p className="mb-1 text-sm font-medium">구성원 초대</p>
            <button
              type="button"
              aria-expanded={inviteOpen}
              onClick={() => setInviteOpen((open) => !open)}
              className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition hover:border-blue-300 focus:border-blue-500"
            >
              {selectedInvite ? (
                <>
                  <MessageMemberAvatar
                    name={selectedInvite.displayName}
                    presenceStatus={selectedInvite.presenceStatus}
                    statusType={selectedInvite.statusType}
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{selectedInvite.displayName}</b>
                    <small className="block truncate text-slate-500">
                      {[
                        selectedInvite.companyName,
                        selectedInvite.jobGradeName,
                        selectedInvite.departmentName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </>
              ) : (
                <span className="flex-1 text-slate-500">구성원을 선택하세요</span>
              )}
              <ChevronDown
                className={`shrink-0 transition-transform ${inviteOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
            {inviteOpen && (
              <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                {inviteCandidates.map((candidate) => (
                  <button
                    key={candidate.membershipId}
                    type="button"
                    onClick={() => {
                      setInviteId(candidate.membershipId);
                      setInviteOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-blue-50 ${inviteId === candidate.membershipId ? "bg-blue-50" : ""}`}
                  >
                    <MessageMemberAvatar
                      name={candidate.displayName}
                      presenceStatus={candidate.presenceStatus}
                      statusType={candidate.statusType}
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-sm">{candidate.displayName}</b>
                      <small className="block truncate text-slate-500">
                        {[candidate.companyName, candidate.jobGradeName, candidate.departmentName]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </button>
                ))}
                {inviteCandidates.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-slate-500">
                    초대할 구성원이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            disabled={!inviteId}
            onClick={() => void run("invite")}
            className="h-9 cursor-pointer rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            초대
          </button>
        </div>
      )}
      <section className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-bold">
          멤버 <span className="text-blue-600">({participants.length || room.memberCount})</span>
        </h3>
        <div className="mt-2 max-h-[calc(100vh-25rem)] overflow-y-auto overflow-x-hidden">
          {participants.map((participant) => {
            const isRoomOwner = participant.membershipId === room.ownerMembershipId;
            const isMe = participant.membershipId === currentMemberId;
            const profile = members.find(
              (member) => member.membershipId === participant.membershipId,
            );
            const presenceStatus = isMe ? "ONLINE" : (profile?.presenceStatus ?? "OFFLINE");
            return (
              <div
                key={participant.membershipId}
                className="group mx-1 my-1 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-blue-50/80"
              >
                {/* 구성원 정보 영역은 클릭하면 공통 사용자 프로필 모달을 연다. */}
                <button
                  type="button"
                  onClick={() => onProfileClick(participant.membershipId)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`${participant.displayName} 사용자 프로필 보기`}
                >
                  <MessageMemberAvatar
                    name={participant.displayName}
                    presenceStatus={presenceStatus}
                    statusType={profile?.statusType}
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">
                      {participant.displayName}
                      {isMe ? " (나)" : ""}
                    </b>
                    <small className="block truncate text-slate-500">
                      {[participant.jobGradeName, participant.departmentName]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </button>
                {isRoomOwner && (
                  <em className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] not-italic text-blue-600">
                    방장
                  </em>
                )}
                {owner && !isMe && (
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => void run("owner", participant.membershipId)}
                      className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[11px] transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      위임
                    </button>
                    <button
                      onClick={() => void run("remove", participant.membershipId)}
                      className="cursor-pointer rounded border border-red-100 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
                    >
                      내보내기
                    </button>
                  </span>
                )}
              </div>
            );
          })}
          {participants.length === 0 && (
            <LoadingState message="참여자를 불러오는 중입니다." className="py-6" />
          )}
        </div>
      </section>
      <button
        onClick={() => void run("leave")}
        className="mt-4 cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 active:scale-[.98]"
      >
        채팅방 나가기
      </button>
    </aside>
  );
}
