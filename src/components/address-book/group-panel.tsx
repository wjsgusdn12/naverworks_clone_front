"use client";

import { GroupAvatar } from "@/components/chat/group-avatar";
import { CustomCheckbox } from "@/components/address-book/custom-checkbox";
import { GroupDetailPanel } from "@/components/address-book/group-detail-panel";
import { MemberPanel } from "@/components/address-book/member-panel";
import { LoadingInline } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import { addressBookApi, type AddressBookMemberDetail } from "@/lib/api/address-book-api";
import { chatApi, type ChatGroupMember, type ChatGroupSummary } from "@/lib/api/chat-api";
import {
  MEMBER_PAGE_SIZE,
  compareGroups,
  filterGroups,
  formatDate,
  formatGroupDate,
  groupColumns,
  groupTabs,
  type GroupSortKey,
  type GroupTab,
} from "@/lib/address-book-group";
import { useEffect, useState } from "react";

export function GroupPanel({
  accessToken,
  myMembershipId,
  groups,
  tab,
  onTabChange,
  showToast,
  onOpenRoom,
}: {
  accessToken: string | null;
  // 그룹 상세 패널의 본인 줄에 "나" 딱지를 붙이기 위한 로그인 사용자 ID.
  myMembershipId: number;
  groups: ChatGroupSummary[] | null;
  tab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  showToast: (message: string) => void;
  onOpenRoom: (roomId: number) => void;
}) {
  // 체크한 그룹. 메시지 버튼은 참여 중인 그룹 하나를 골랐을 때만 그 방을 엶.
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  // 오른쪽 상세 패널. 그룹을 누르면 그룹 상세, 그 안에서 구성원을 누르면 구성원 상세로 바뀜.
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupSummary | null>(null);
  const [groupMembers, setGroupMembers] = useState<ChatGroupMember[] | null>(null);
  const [selectedMember, setSelectedMember] = useState<AddressBookMemberDetail | null>(null);

  // 그룹을 고르면 구성원 목록을 조회. 다른 그룹을 고르면 이전 응답은 버림.
  useEffect(() => {
    if (!accessToken || !selectedGroup) return;
    let cancelled = false;
    chatApi
      .groupMembers(accessToken, selectedGroup.id)
      .then((result) => {
        if (!cancelled) setGroupMembers(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGroupMembers([]);
        showToast(error instanceof Error ? error.message : "그룹 구성원을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedGroup, showToast]);

  const selectGroup = (group: ChatGroupSummary) => {
    setSelectedMember(null);
    setGroupMembers(null);
    setSelectedGroup(group);
  };

  // 패널 전체를 닫음(그룹·구성원 상세 모두).
  const closePanel = () => {
    setSelectedMember(null);
    setSelectedGroup(null);
    setGroupMembers(null);
  };

  const selectGroupMember = async (target: ChatGroupMember) => {
    if (!accessToken) return;
    try {
      setSelectedMember(await addressBookApi.memberDetail(accessToken, target.membershipId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "구성원 정보를 불러오지 못했습니다.");
    }
  };

  // 구성원 상세의 별표 토글. 그룹 구성원 목록의 즐겨찾기 딱지도 함께 갱신.
  const toggleMemberFavorite = async () => {
    if (!accessToken || !selectedMember) return;
    const target = selectedMember;
    const nextFavorite = !target.favorite;
    setSelectedMember({ ...target, favorite: nextFavorite });
    setGroupMembers(
      (current) =>
        current?.map((member) =>
          member.membershipId === target.membershipId
            ? { ...member, favorite: nextFavorite }
            : member,
        ) ?? null,
    );
    try {
      if (target.favorite) await addressBookApi.deleteFavorite(accessToken, target.membershipId);
      else await addressBookApi.createFavorite(accessToken, target.membershipId);
    } catch (error) {
      setSelectedMember(target);
      setGroupMembers(
        (current) =>
          current?.map((member) =>
            member.membershipId === target.membershipId
              ? { ...member, favorite: target.favorite }
              : member,
          ) ?? null,
      );
      showToast(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했습니다.");
    }
  };

  const openDirectMessage = async (targetMembershipId: number) => {
    if (!accessToken) return;
    try {
      const room = await chatApi.createDirect(accessToken, targetMembershipId);
      onOpenRoom(room.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지방을 열지 못했습니다.");
    }
  };

  // 정렬 상태. 이름은 가나다순, 나머지는 큰 값이 먼저 보이도록 기본 방향을 둠.
  const [sortKey, setSortKey] = useState<GroupSortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // 탭·정렬이 바뀌면 1페이지로 돌아가도록 키와 함께 저장.
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const filterKey = `${tab}|${sortKey}|${sortDirection}`;
  const page = pageState.key === filterKey ? pageState.page : 0;

  const selectSort = (key: GroupSortKey) => {
    if (sortKey === key) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  };

  const visible = filterGroups(groups ?? [], tab).sort(
    (a, b) => compareGroups(a, b, sortKey) * (sortDirection === "asc" ? 1 : -1),
  );
  const totalPages = Math.max(Math.ceil(visible.length / MEMBER_PAGE_SIZE), 1);
  const pageGroups = visible.slice(page * MEMBER_PAGE_SIZE, (page + 1) * MEMBER_PAGE_SIZE);
  const allPageSelected =
    pageGroups.length > 0 && pageGroups.every((group) => selectedGroupIds.includes(group.id));

  const openGroup = (group: ChatGroupSummary) =>
    group.joined
      ? onOpenRoom(group.id)
      : showToast("참여 중인 그룹만 열 수 있습니다. 방장에게 초대를 요청해 주세요.");

  const toggleGroupSelection = (groupId: number) =>
    setSelectedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );

  const toggleAllGroupSelection = () =>
    setSelectedGroupIds(allPageSelected ? [] : pageGroups.map((group) => group.id));

  const openSelectedGroup = () => {
    const selected = (groups ?? []).filter((group) => selectedGroupIds.includes(group.id));
    if (selected.length !== 1) {
      showToast("메시지는 그룹을 하나만 선택했을 때 열 수 있습니다.");
      return;
    }
    openGroup(selected[0]);
  };

  return (
    <>
      <div className="mb-4 flex h-9 items-center gap-2">
        <CustomCheckbox
          label="전체 그룹 선택"
          checked={allPageSelected}
          onChange={toggleAllGroupSelection}
        />
        <button
          disabled={selectedGroupIds.length === 0}
          className="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-600 transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => showToast("메일 기능은 준비 중입니다.")}
        >
          메일
        </button>
        <button
          disabled={selectedGroupIds.length === 0}
          className="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-600 transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={openSelectedGroup}
        >
          메시지
        </button>
      </div>
      <div className="flex gap-5" role="tablist">
        {groupTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`cursor-pointer border-b-2 px-1 pb-2.5 text-sm transition ${tab === key ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            onClick={() => onTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* 구성원 목록과 같은 틀: 위쪽 선이 있는 표 + 바닥 고정 페이지 영역. */}
      <div className="flex flex-1 border-t border-slate-200">
        <div className="min-w-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-white text-slate-700">
              <tr>
                <th className="w-11 px-3 py-3" />
                {groupColumns.map(([key, label]) => (
                  <th key={key} className="px-4 py-3 font-semibold">
                    <button
                      className="cursor-pointer hover:text-blue-600"
                      onClick={() => selectSort(key)}
                    >
                      {label}
                      {sortKey === key ? (sortDirection === "asc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageGroups.map((group) => (
                <tr
                  key={group.id}
                  className={`cursor-pointer border-b border-slate-100 transition hover:bg-blue-50 ${selectedGroup?.id === group.id ? "bg-blue-50" : ""} ${group.joined ? "" : "text-slate-500"}`}
                  onClick={() => selectGroup(group)}
                >
                  <td className="px-3 py-3">
                    <span onClick={(event) => event.stopPropagation()}>
                      <CustomCheckbox
                        label={`${group.name || "이름 없는 그룹"} 선택`}
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <GroupAvatar name={group.name || "그룹"} />
                      <b className={group.joined ? "text-slate-900" : ""}>
                        {group.name || "이름 없는 그룹"}
                      </b>
                      {group.owner && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          마스터
                        </span>
                      )}
                      {!group.joined && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          미참여
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-blue-600">{group.memberCount}</td>
                  <td className="px-4 py-3">{formatGroupDate(group.lastMessageAt)}</td>
                  <td className="px-4 py-3">{formatDate(group.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups === null ? (
            <LoadingInline message="그룹 목록을 불러오는 중입니다." className="py-10 text-sm" />
          ) : (
            visible.length === 0 && (
              <p className="p-12 text-center text-sm text-slate-500">
                {tab === "joined"
                  ? "참여 중인 그룹이 없습니다."
                  : tab === "owner"
                    ? "내가 방장인 그룹이 없습니다."
                    : "회사에 그룹 채팅방이 없습니다."}
              </p>
            )
          )}
        </div>
        {selectedMember ? (
          <MemberPanel
            member={selectedMember}
            onClose={closePanel}
            onToggleFavorite={() => void toggleMemberFavorite()}
            onMessage={() => void openDirectMessage(selectedMember.membershipId)}
            showToast={showToast}
          />
        ) : (
          selectedGroup && (
            <GroupDetailPanel
              group={selectedGroup}
              members={groupMembers}
              myMembershipId={myMembershipId}
              onClose={closePanel}
              onSelectMember={(target) => void selectGroupMember(target)}
              onMessage={() => openGroup(selectedGroup)}
              showToast={showToast}
            />
          )
        )}
      </div>
      <div className="-mx-6 flex h-12 shrink-0 items-center justify-center border-t border-slate-200">
        {visible.length > 0 && (
          <Pagination
            label="그룹 목록 페이지"
            page={page}
            totalPages={totalPages}
            onChange={(nextPage) => setPageState({ key: filterKey, page: nextPage })}
          />
        )}
      </div>
    </>
  );
}
