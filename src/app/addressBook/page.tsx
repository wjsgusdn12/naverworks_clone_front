"use client";

import { PageLoading, Spinner } from "@/components/common/loading";
import { CompanyMoveDialog } from "@/components/common/company-move-dialog";
import { GlobalHeader } from "@/components/common/global-header";
import { AddressBookSearch } from "@/components/address-book/address-book-search";
import { CustomCheckbox } from "@/components/common/custom-checkbox";
import { GroupPanel } from "@/components/address-book/group-panel";
import { MemberPanel } from "@/components/address-book/member-panel";
import { MemberTable } from "@/components/address-book/member-table";
import {
  OrganizationSidebar,
  type AddressBookView,
} from "@/components/address-book/organization-sidebar";
import { Toast } from "@/components/common/toast";
import { Pagination } from "@/components/common/pagination";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import {
  addressBookApi,
  type AddressBookMember,
  type AddressBookMemberDetail,
  type AddressBookSearchHistory,
} from "@/lib/api/address-book-api";
import { chatApi, type ChatGroupSummary } from "@/lib/api/chat-api";
import { MEMBER_PAGE_SIZE, filterGroups, type GroupTab } from "@/lib/address-book-group";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import { withLiveStatus } from "@/lib/live-status";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function AddressBookPage() {
  const router = useRouter();
  const { accessToken, member, status, applySession, logout } = useAuth();
  const { presenceByMembershipId, memberStatusByMembershipId } = useChatNotification();
  const { toast, showToast, dismissToast, resetToast } = useToast();
  const [view, setView] = useState<AddressBookView>("company");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<
    Awaited<ReturnType<typeof addressBookApi.organization>>
  >([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [isOrganizationExpanded, setIsOrganizationExpanded] = useState(true);
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<number[]>([]);
  const [members, setMembers] = useState<AddressBookMember[]>([]);
  // 제목 옆 인원수. 50명씩 끊어 받으므로 목록 길이 대신 서버의 전체 건수를 사용.
  const [memberTotal, setMemberTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // 페이지 번호를 당시 필터 키와 함께 저장해, 보기·정렬·검색이 바뀌면 자동으로 1페이지로 돌아감.
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  // 그룹 탭 상태. 제목 옆에 현재 탭의 그룹 수를 보여 주기 위해 페이지에서 관리.
  const [groupTab, setGroupTab] = useState<GroupTab>("joined");
  const [groups, setGroups] = useState<ChatGroupSummary[] | null>(null);
  const [selectedMember, setSelectedMember] = useState<AddressBookMemberDetail | null>(null);
  const [keyword, setKeyword] = useState("");
  const [executedKeyword, setExecutedKeyword] = useState("");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState("asc");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [saveSearchEnabled, setSaveSearchEnabled] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // 사이드바 "회사 만들기"로 여는 회사 옮기기 대화상자.
  const [isCompanyMoveOpen, setIsCompanyMoveOpen] = useState(false);
  const [showPreviewProfileImage, setShowPreviewProfileImage] = useState(true);
  const [previewMembers, setPreviewMembers] = useState<AddressBookMember[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [hasMorePreview, setHasMorePreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<AddressBookSearchHistory[]>([]);
  // 처음 불러오는 동안 빈 목록 안내 대신 로딩 표시를 보이기 위한 상태들.
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isRecentSearchLoading, setIsRecentSearchLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const previewRequestIdRef = useRef(0);
  // REST 조회 결과 위에 WebSocket의 최신 접속 상태·상태 설정을 덮어 실시간 배지를 유지.
  const displayMembers = useMemo(
    () =>
      members.map((target) =>
        withLiveStatus(target, presenceByMembershipId, memberStatusByMembershipId),
      ),
    [members, presenceByMembershipId, memberStatusByMembershipId],
  );

  // 주소록 프로필에서 1:1 채팅방을 준비한 뒤 해당 방을 바로 엶.
  const openDirectMessage = async (targetMembershipId: number) => {
    if (!accessToken) return;
    try {
      const room = await chatApi.createDirect(accessToken, targetMembershipId);
      router.push(`/message?roomId=${room.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메시지방을 열지 못했습니다.");
    }
  };

  const filterKey = [view, companyId, departmentId, sort, direction, executedKeyword].join("|");
  const page = pageState.key === filterKey ? pageState.page : 0;
  const changePage = (nextPage: number) => setPageState({ key: filterKey, page: nextPage });

  const loadMembers = useCallback(async () => {
    if (!accessToken) return;
    const parameters = new URLSearchParams({
      page: String(page),
      size: String(MEMBER_PAGE_SIZE),
      sort,
      direction,
    });
    if (executedKeyword.trim()) parameters.set("keyword", executedKeyword.trim());
    if (view !== "favorite" && companyId) parameters.set("companyId", String(companyId));
    if (view === "department" && departmentId) parameters.set("departmentId", String(departmentId));
    if (view === "favorite") parameters.set("favoriteOnly", "true");
    setIsMembersLoading(true);
    try {
      const result = await addressBookApi.member(accessToken, parameters);
      setMembers(result.content);
      setMemberTotal(result.totalElements);
      setTotalPages(Math.max(result.totalPages, 1));
    } finally {
      setIsMembersLoading(false);
    }
  }, [accessToken, companyId, departmentId, direction, executedKeyword, page, sort, view]);

  useEffect(() => {
    if (status === "unauthenticated") {
      if (!isLoggingOut) markAuthenticationRequired();
      router.replace("/");
      return;
    }
    if (!accessToken) return;
    void (async () => {
      try {
        const organization = await addressBookApi.organization(accessToken);
        setOrganizations(organization);
        const currentCompany = organization.find((item) => item.currentCompany) ?? organization[0];
        if (currentCompany) {
          setCompanyId(currentCompany.companyId);
          setExpandedCompanyIds([currentCompany.companyId]);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
      } finally {
        setIsOrganizationLoading(false);
      }
    })();
  }, [accessToken, isLoggingOut, router, showToast, status]);

  useEffect(() => {
    if (!accessToken || !isSearchFocused || keyword.trim() || !saveSearchEnabled) return;
    void Promise.resolve()
      .then(() => {
        setIsRecentSearchLoading(true);
        return addressBookApi.searchHistory(accessToken);
      })
      .then(setRecentSearches)
      .catch((error: unknown) =>
        showToast(error instanceof Error ? error.message : "최근 검색어를 불러오지 못했습니다."),
      )
      .finally(() => setIsRecentSearchLoading(false));
  }, [accessToken, isSearchFocused, keyword, saveSearchEnabled, showToast]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || view === "group") return;
    // 회사 필터가 정해지기 전에 전체 목록을 한 번 더 받지 않도록 조직도를 먼저 기다림.
    if (isOrganizationLoading && view !== "favorite") return;
    // 렌더링 직후 비동기로 목록을 갱신해 Effect 안의 동기 상태 변경을 피함.
    void Promise.resolve()
      .then(loadMembers)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
      });
  }, [accessToken, isOrganizationLoading, loadMembers, showToast, status, view]);

  // 그룹 탭에 들어올 때 회사의 그룹 채팅방 목록을 조회.
  useEffect(() => {
    if (status !== "authenticated" || !accessToken || view !== "group") return;
    let cancelled = false;
    chatApi
      .groupRooms(accessToken)
      .then((result) => {
        if (!cancelled) setGroups(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGroups([]);
        showToast(error instanceof Error ? error.message : "그룹 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, showToast, status, view]);

  useEffect(() => {
    const closeSearchPreview = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) setIsSearchFocused(false);
    };
    const closeSearchPreviewOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSearchFocused(false);
    };
    document.addEventListener("mousedown", closeSearchPreview);
    document.addEventListener("keydown", closeSearchPreviewOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeSearchPreview);
      document.removeEventListener("keydown", closeSearchPreviewOnEscape);
    };
  }, []);

  useEffect(() => {
    const normalizedKeyword = keyword.trim();
    const requestId = ++previewRequestIdRef.current;
    if (!isSearchFocused || !accessToken || !normalizedKeyword) {
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      setIsPreviewLoading(true);
      addressBookApi
        .memberSuggest(accessToken, normalizedKeyword, 0, abortController.signal)
        .then((result) => {
          // 늦게 도착한 이전 검색어의 응답은 현재 미리보기를 덮어쓰지 않음.
          if (requestId !== previewRequestIdRef.current) return;
          setPreviewMembers(result.content);
          setPreviewPage(result.page);
          setHasMorePreview(result.page + 1 < result.totalPages);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (requestId === previewRequestIdRef.current)
            showToast(
              error instanceof Error ? error.message : "검색 미리보기를 불러오지 못했습니다.",
            );
        })
        .finally(() => {
          if (requestId === previewRequestIdRef.current) setIsPreviewLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [accessToken, isSearchFocused, keyword, showToast]);

  const selectMember = async (target: AddressBookMember) => {
    if (!accessToken) return;
    try {
      setSelectedMember(await addressBookApi.memberDetail(accessToken, target.membershipId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "구성원 정보를 불러오지 못했습니다.");
    }
  };

  const toggleFavorite = async (target: AddressBookMember) => {
    if (!accessToken) return;
    const previousMembers = members;
    const nextFavorite = !target.favorite;
    // 서버 응답을 기다리지 않고 별표를 즉시 바꿔 클릭 반응을 보장.
    setMembers((currentMembers) =>
      currentMembers
        .map((currentMember) =>
          currentMember.membershipId === target.membershipId
            ? { ...currentMember, favorite: nextFavorite }
            : currentMember,
        )
        .filter((currentMember) => view !== "favorite" || currentMember.favorite),
    );
    if (selectedMember?.membershipId === target.membershipId) {
      setSelectedMember({ ...selectedMember, favorite: nextFavorite });
    }
    try {
      if (target.favorite) await addressBookApi.deleteFavorite(accessToken, target.membershipId);
      else await addressBookApi.createFavorite(accessToken, target.membershipId);
    } catch (error) {
      // 저장 실패 시에만 클릭 직전 목록으로 되돌려 화면과 DB 상태를 맞춤.
      setMembers(previousMembers);
      if (selectedMember?.membershipId === target.membershipId)
        setSelectedMember({ ...selectedMember, favorite: target.favorite });
      showToast(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했습니다.");
    }
  };

  const selectSort = (nextSort: string) => {
    if (nextSort === sort) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(nextSort);
      setDirection("asc");
    }
  };

  const toggleMemberSelection = (membershipId: number) => {
    setSelectedMemberIds((currentIds) =>
      currentIds.includes(membershipId)
        ? currentIds.filter((id) => id !== membershipId)
        : [...currentIds, membershipId],
    );
  };

  const toggleAllMemberSelection = () => {
    setSelectedMemberIds((currentIds) =>
      currentIds.length === members.length ? [] : members.map((target) => target.membershipId),
    );
  };

  const executeSearch = () => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;
    setIsSearchFocused(false);
    if (accessToken && saveSearchEnabled && normalizedKeyword) {
      void addressBookApi
        .createSearchHistory(accessToken, normalizedKeyword)
        .then(() => addressBookApi.searchHistory(accessToken))
        .then(setRecentSearches)
        .catch((error: unknown) =>
          showToast(error instanceof Error ? error.message : "최근 검색어를 저장하지 못했습니다."),
        );
    }
    // 검색 결과는 주소록 원본 목록과 분리한 전용 화면에서 확인.
    router.push(`/addressBook/search?keyword=${encodeURIComponent(normalizedKeyword)}`);
  };

  const clearSearch = () => {
    setKeyword("");
    setExecutedKeyword("");
    setPreviewMembers([]);
    setPreviewPage(0);
    setHasMorePreview(false);
    setIsSearchFocused(false);
  };

  const changeKeyword = (nextKeyword: string) => {
    // 새 키워드는 기존 결과와 섞이지 않도록 즉시 미리보기 목록을 초기화.
    setPreviewMembers([]);
    setPreviewPage(0);
    setHasMorePreview(false);
    // 입력 직후(요청 대기 180ms 동안)에도 "없습니다" 대신 로딩 표시가 보이도록 바로 켬.
    setIsPreviewLoading(Boolean(nextKeyword.trim()));
    setKeyword(nextKeyword);
  };

  const clearRecentSearches = async () => {
    if (!accessToken) return;
    try {
      await addressBookApi.deleteSearchHistory(accessToken);
      setRecentSearches([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "최근 검색어를 삭제하지 못했습니다.");
    }
  };

  const deleteRecentSearch = async (searchHistoryId: number) => {
    if (!accessToken) return;
    try {
      await addressBookApi.deleteSearchHistoryItem(accessToken, searchHistoryId);
      setRecentSearches((currentSearches) =>
        currentSearches.filter((search) => search.id !== searchHistoryId),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "최근 검색어를 삭제하지 못했습니다.");
    }
  };

  const selectRecentSearch = (searchKeyword: string) => {
    changeKeyword(searchKeyword);
    setIsSearchFocused(false);
    router.push(`/addressBook/search?keyword=${encodeURIComponent(searchKeyword)}`);
  };

  const resetAddressBookState = () => {
    previewRequestIdRef.current += 1;
    setIsProfileMenuOpen(false);
    setSelectedMember(null);
    setSelectedMemberIds([]);
    setKeyword("");
    setExecutedKeyword("");
    setPreviewMembers([]);
    setRecentSearches([]);
    setIsSearchFocused(false);
    resetToast();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    resetAddressBookState();
    await logout();
    router.replace("/");
  };

  const loadMorePreview = useCallback(async () => {
    const normalizedKeyword = keyword.trim();
    if (!accessToken || !normalizedKeyword || isPreviewLoading || !hasMorePreview) return;

    const requestId = previewRequestIdRef.current;
    setIsPreviewLoading(true);
    try {
      const result = await addressBookApi.memberSuggest(
        accessToken,
        normalizedKeyword,
        previewPage + 1,
      );
      // 다음 페이지를 받을 때 새 검색이 시작됐으면 결과를 추가하지 않음.
      if (requestId !== previewRequestIdRef.current) return;
      setPreviewMembers((currentMembers) => [...currentMembers, ...result.content]);
      setPreviewPage(result.page);
      setHasMorePreview(result.page + 1 < result.totalPages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "검색 미리보기를 불러오지 못했습니다.");
    } finally {
      if (requestId === previewRequestIdRef.current) setIsPreviewLoading(false);
    }
  }, [accessToken, hasMorePreview, isPreviewLoading, keyword, previewPage, showToast]);

  if (status !== "authenticated" || !member) return <PageLoading />;

  const selectedCompany = organizations.find(
    (organization) => organization.companyId === companyId,
  );
  const selectedDepartment = selectedCompany?.departments.find(
    (department) => department.id === departmentId,
  );
  // 부서를 고른 상태면 회사명 대신 부서명을 제목으로 사용.
  const sectionTitle =
    view === "favorite"
      ? "즐겨찾기"
      : view === "group"
        ? "그룹"
        : view === "department" && selectedDepartment
          ? selectedDepartment.name
          : selectedCompany?.companyName || "주소록";

  const selectCompany = (targetCompanyId: number) => {
    setCompanyId(targetCompanyId);
    setDepartmentId(null);
    setView("company");
  };

  const toggleCompanyExpanded = (targetCompanyId: number) => {
    setExpandedCompanyIds((current) =>
      current.includes(targetCompanyId)
        ? current.filter((id) => id !== targetCompanyId)
        : [...current, targetCompanyId],
    );
  };

  const selectDepartment = (targetCompanyId: number, targetDepartmentId: number) => {
    setCompanyId(targetCompanyId);
    setDepartmentId((current) => (current === targetDepartmentId ? null : targetDepartmentId));
    setView((current) =>
      current === "department" && departmentId === targetDepartmentId ? "company" : "department",
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <GlobalHeader
        role={member.role}
        pageTitle="주소록"
        isAuthenticated
        profileName={member.displayName}
        onToast={showToast}
        isProfileMenuOpen={isProfileMenuOpen}
        onHomeAction={() => router.push("/home")}
        onServiceAction={(label) =>
          label === "메시지"
            ? router.push("/message")
            : ["주소록", "조직도"].includes(label)
              ? router.push("/addressBook")
              : showToast(`${label} 기능은 준비 중입니다.`)
        }
        onProfileAction={() => setIsProfileMenuOpen((open) => !open)}
        onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
        onLogout={() => void handleLogout()}
        onSidebarToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        isSidebarCollapsed={isSidebarCollapsed}
        headerContent={
          <AddressBookSearch
            containerRef={searchContainerRef}
            keyword={keyword}
            isFocused={isSearchFocused}
            saveSearchEnabled={saveSearchEnabled}
            previewMembers={previewMembers}
            recentSearches={recentSearches}
            isRecentSearchLoading={isRecentSearchLoading}
            isPreviewLoading={isPreviewLoading}
            showPreviewProfileImage={showPreviewProfileImage}
            onChange={changeKeyword}
            onFocus={() => setIsSearchFocused(true)}
            onClear={clearSearch}
            onClearHistory={() => void clearRecentSearches()}
            onDeleteHistory={(searchHistoryId) => void deleteRecentSearch(searchHistoryId)}
            onSaveToggle={() => setSaveSearchEnabled((enabled) => !enabled)}
            onProfileImageToggle={() => setShowPreviewProfileImage((visible) => !visible)}
            onSearch={executeSearch}
            onLoadMore={loadMorePreview}
            onRecentSearchSelect={selectRecentSearch}
            onPreviewSelect={(target) => {
              setIsSearchFocused(false);
              router.push(`/addressBook/search?keyword=${encodeURIComponent(target.displayName)}`);
            }}
          />
        }
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto">
        <OrganizationSidebar
          isCollapsed={isSidebarCollapsed}
          view={view}
          organizations={organizations}
          organizationLoading={isOrganizationLoading}
          companyId={companyId}
          departmentId={departmentId}
          isOrganizationExpanded={isOrganizationExpanded}
          expandedCompanyIds={expandedCompanyIds}
          onCreateCompany={() => setIsCompanyMoveOpen(true)}
          onCreateGroupRoom={() => router.push("/message?create=group")}
          onSelectView={(nextView) => {
            setView(nextView);
            setDepartmentId(null);
          }}
          onToggleOrganizationExpanded={() => setIsOrganizationExpanded((expanded) => !expanded)}
          onToggleCompanyExpanded={toggleCompanyExpanded}
          onSelectCompany={selectCompany}
          onSelectDepartment={selectDepartment}
        />
        {/* 세로 flex로 두어 표가 남은 높이를 채우고 페이지 영역이 바닥에 붙음. 아래 여백은 0. */}
        <section className="flex min-w-0 flex-1 flex-col p-6 pb-0">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h1 className="flex items-baseline gap-2 text-xl font-bold">
              {sectionTitle}
              {/* 그룹 탭은 현재 탭의 그룹 수, 나머지는 현재 목록의 전체 인원수. 제목과 같은 크기. */}
              {view === "group" ? (
                groups !== null && (
                  <span className="font-bold text-blue-600">
                    {filterGroups(groups, groupTab).length}
                  </span>
                )
              ) : (
                <span className="font-bold text-blue-600">
                  {isMembersLoading ? <Spinner size={16} className="text-blue-500" /> : memberTotal}
                </span>
              )}
            </h1>
          </div>
          {view === "group" ? (
            <GroupPanel
              accessToken={accessToken}
              myMembershipId={member.membershipId}
              groups={groups}
              tab={groupTab}
              onTabChange={setGroupTab}
              showToast={showToast}
              onOpenRoom={(roomId) => router.push(`/message?roomId=${roomId}`)}
            />
          ) : (
            <>
              <div className="mb-4 flex h-9 items-center gap-2">
                <CustomCheckbox
                  label="전체 구성원 선택"
                  checked={members.length > 0 && selectedMemberIds.length === members.length}
                  onChange={toggleAllMemberSelection}
                />
                <button
                  disabled={selectedMemberIds.length === 0}
                  className="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-600 transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => showToast("메일 기능은 준비 중입니다.")}
                >
                  메일
                </button>
                <button
                  disabled={selectedMemberIds.length === 0}
                  className="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-600 transition enabled:cursor-pointer enabled:hover:border-blue-300 enabled:hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() =>
                    router.push(`/message?create=group&memberIds=${selectedMemberIds.join(",")}`)
                  }
                >
                  메시지
                </button>
              </div>
              <div className="flex flex-1 border-t border-slate-200">
                <MemberTable
                  members={displayMembers}
                  myMembershipId={member.membershipId}
                  selectedMemberId={selectedMember?.membershipId ?? null}
                  selectedMemberIds={selectedMemberIds}
                  sort={sort}
                  direction={direction}
                  onSort={selectSort}
                  onSelectMember={(target) => void selectMember(target)}
                  onToggleFavorite={(target) => void toggleFavorite(target)}
                  onToggleSelection={toggleMemberSelection}
                  loading={isMembersLoading}
                />
                {selectedMember && (
                  <MemberPanel
                    member={selectedMember}
                    onClose={() => setSelectedMember(null)}
                    onToggleFavorite={() => void toggleFavorite(selectedMember)}
                    onMessage={() => void openDirectMessage(selectedMember.membershipId)}
                    showToast={showToast}
                  />
                )}
              </div>
              {/* 바닥 고정 영역. 섹션 좌우 여백만큼 바깥으로 빼서 위쪽 선이 끝까지 이어짐. */}
              <div className="-mx-6 flex h-12 shrink-0 items-center justify-center border-t border-slate-200">
                {memberTotal > 0 && (
                  <Pagination
                    label="구성원 목록 페이지"
                    page={page}
                    totalPages={totalPages}
                    onChange={changePage}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </main>
      {isCompanyMoveOpen && accessToken && (
        <CompanyMoveDialog
          accessToken={accessToken}
          currentCompanyName={member.companyName}
          initialJoinType="NEW_COMPANY"
          onMoved={(session) => {
            setIsCompanyMoveOpen(false);
            applySession(session);
            showToast(`${session.member.companyName} 소속으로 옮겼습니다.`);
          }}
          onToast={showToast}
          onClose={() => setIsCompanyMoveOpen(false)}
        />
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}
