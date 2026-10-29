"use client";

import { GlobalHeader } from "@/components/common/global-header";
import { FavoriteButton } from "@/components/address-book/favorite-button";
import { Toast } from "@/components/common/toast";
import { LoadingInline } from "@/components/common/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatNotification } from "@/components/chat/chat-notification-provider";
import {
  addressBookApi,
  type AddressBookMember,
  type AddressBookMemberDetail,
  type AddressBookSearchHistory,
} from "@/lib/api/address-book-api";
import { chatApi, type ChatGroupSummary } from "@/lib/api/chat-api";
import { markAuthenticationRequired } from "@/lib/auth-required-notice";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Mail,
  MessageCircle,
  Search,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";

type AddressBookView = "favorite" | "group" | "company" | "department";

// 구성원 목록 한 페이지 크기.
const MEMBER_PAGE_SIZE = 20;

// 현재 페이지 주변으로 최대 5개의 번호만 보여 줌.
const visiblePages = (page: number, totalPages: number) => {
  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  const end = Math.min(totalPages, start + 5);
  return Array.from({ length: end - start }, (_, index) => start + index);
};

const statusClassName = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-slate-300",
  AWAY: "bg-slate-500 text-white",
  INACTIVE: "bg-red-500 text-white",
} as const;

export default function AddressBookPage() {
  const router = useRouter();
  const { accessToken, member, status, logout } = useAuth();
  const { presenceByMembershipId } = useChatNotification();
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
  const [showPreviewProfileImage, setShowPreviewProfileImage] = useState(true);
  const [previewMembers, setPreviewMembers] = useState<AddressBookMember[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [hasMorePreview, setHasMorePreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<AddressBookSearchHistory[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const previewRequestIdRef = useRef(0);
  // REST 조회 결과 위에 WebSocket의 최신 접속 상태를 덮어 실시간 배지를 유지.
  const displayMembers = useMemo(
    () =>
      members.map((target) => {
        const online = presenceByMembershipId[target.membershipId];
        return online === undefined
          ? target
          : { ...target, presenceStatus: online ? ("ONLINE" as const) : ("OFFLINE" as const) };
      }),
    [members, presenceByMembershipId],
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
    const result = await addressBookApi.member(accessToken, parameters);
    setMembers(result.content);
    setMemberTotal(result.totalElements);
    setTotalPages(Math.max(result.totalPages, 1));
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
      }
    })();
  }, [accessToken, isLoggingOut, router, showToast, status]);

  useEffect(() => {
    if (!accessToken || !isSearchFocused || keyword.trim() || !saveSearchEnabled) return;
    void addressBookApi
      .searchHistory(accessToken)
      .then(setRecentSearches)
      .catch((error: unknown) =>
        showToast(error instanceof Error ? error.message : "최근 검색어를 불러오지 못했습니다."),
      );
  }, [accessToken, isSearchFocused, keyword, saveSearchEnabled, showToast]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || view === "group") return;
    // 렌더링 직후 비동기로 목록을 갱신해 Effect 안의 동기 상태 변경을 피함.
    void Promise.resolve()
      .then(loadMembers)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
      });
  }, [accessToken, loadMembers, showToast, status, view]);

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

  if (status !== "authenticated" || !member) return <div className="min-h-screen bg-slate-100" />;

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
    <div className="min-h-screen bg-white text-slate-900">
      <GlobalHeader
        role={member.role}
        pageTitle="주소록"
        isAuthenticated
        profileName={member.displayName}
        profileLabel={`${member.displayName} · ${member.role === "ADMIN" ? "관리자" : "일반 사용자"}`}
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
      <main className="flex min-h-[calc(100vh-3.5rem)]">
        <aside
          className={`shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ease-out ${isSidebarCollapsed ? "w-20 p-2" : "w-64 p-3"}`}
        >
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-4 pt-2">
              <button
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-950 text-2xl text-white transition hover:scale-105 active:scale-95"
                onClick={() => showToast("새로 만들기 기능은 준비 중입니다.")}
              >
                +
              </button>
              <SidebarIcon
                label="조직도"
                icon={<Building2 size={20} />}
                onClick={() => {
                  setView("company");
                  setDepartmentId(null);
                }}
              />
              <SidebarIcon
                label="즐겨찾기"
                icon={<Star size={20} />}
                onClick={() => {
                  setView("favorite");
                  setDepartmentId(null);
                }}
              />
              <SidebarIcon
                label="그룹"
                icon={<UsersRound size={20} />}
                onClick={() => {
                  setView("group");
                  setDepartmentId(null);
                }}
              />
            </div>
          ) : (
            <>
              <button
                className="mb-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800"
                onClick={() => showToast("그룹 생성 기능은 준비 중입니다.")}
              >
                새로 만들기 <ChevronDown className="ml-1" size={15} />
              </button>
              <div className="grid grid-cols-2 border-b border-slate-200 pb-3 text-sm">
                <button
                  className={`cursor-pointer rounded-md py-2 ${view === "favorite" ? "text-blue-600" : "text-slate-600"}`}
                  onClick={() => {
                    setView("favorite");
                    setDepartmentId(null);
                  }}
                >
                  <Star className="mx-auto mb-1" size={18} />
                  즐겨찾기
                </button>
                <button
                  className={`cursor-pointer rounded-md py-2 ${view === "group" ? "text-blue-600" : "text-slate-600"}`}
                  onClick={() => {
                    setView("group");
                    setDepartmentId(null);
                  }}
                >
                  <UsersRound className="mx-auto mb-1" size={18} />
                  그룹
                </button>
              </div>
              <div className="mt-4 text-sm">
                <div className="mb-2 flex items-center gap-1 px-1 py-1 font-medium text-slate-600">
                  <button
                    type="button"
                    aria-label={`조직도 ${isOrganizationExpanded ? "접기" : "펼치기"}`}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded transition hover:bg-slate-200 active:scale-90"
                    onClick={() => setIsOrganizationExpanded((expanded) => !expanded)}
                  >
                    {isOrganizationExpanded ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </button>
                  <span>조직도</span>
                </div>
                {isOrganizationExpanded &&
                  organizations.map((organization) => {
                    const isCompanyExpanded = expandedCompanyIds.includes(organization.companyId);
                    return (
                      <div key={organization.companyId}>
                        <div
                          className={`flex w-full items-center rounded-md ${view === "company" && companyId === organization.companyId ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"}`}
                        >
                          <button
                            type="button"
                            aria-label={`${organization.companyName} ${isCompanyExpanded ? "접기" : "펼치기"}`}
                            className="ml-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded transition hover:bg-blue-100 active:scale-90"
                            onClick={() => toggleCompanyExpanded(organization.companyId)}
                          >
                            {isCompanyExpanded ? (
                              <ChevronDown size={15} />
                            ) : (
                              <ChevronRight size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-3 text-left"
                            onClick={() => selectCompany(organization.companyId)}
                          >
                            <Building2 size={17} />
                            <span className="truncate">{organization.companyName}</span>
                            {/* 사용 중인 계정 기준 회사 인원수. */}
                            <span className="shrink-0 text-xs font-bold text-blue-600">
                              {organization.memberCount}
                            </span>
                          </button>
                        </div>
                        {isCompanyExpanded &&
                          organization.departments.map((department) => (
                            <button
                              key={department.id}
                              className={`ml-8 flex w-[calc(100%-2rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left ${view === "department" && departmentId === department.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"}`}
                              onClick={() =>
                                selectDepartment(organization.companyId, department.id)
                              }
                            >
                              <UsersRound size={16} />
                              {department.name}
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </aside>
        <section className="min-w-0 flex-1 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h1 className="flex items-baseline gap-2 text-xl font-bold">
              {sectionTitle}
              {/* 그룹 탭은 패널 안에 개수가 있어 제외. 나머지는 현재 목록의 전체 인원수. */}
              {view !== "group" && (
                <span className="text-base font-bold text-blue-600">{memberTotal}</span>
              )}
            </h1>
          </div>
          {view === "group" ? (
            <GroupPanel
              accessToken={accessToken}
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
              <div className="flex min-h-[calc(100vh-15rem)] border-y border-slate-200">
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
                            <button
                              className="cursor-pointer hover:text-blue-600"
                              onClick={() => selectSort(key)}
                            >
                              {label}
                              {sort === key ? (direction === "asc" ? " ↓" : " ↑") : ""}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayMembers.map((target) => (
                        <tr
                          key={target.membershipId}
                          className={`cursor-pointer border-b border-slate-100 transition hover:bg-blue-50 ${selectedMember?.membershipId === target.membershipId ? "bg-blue-50" : ""}`}
                          onClick={() => void selectMember(target)}
                        >
                          <td className="px-3 py-3">
                            <span onClick={(event) => event.stopPropagation()}>
                              <CustomCheckbox
                                label={`${target.displayName} 선택`}
                                checked={selectedMemberIds.includes(target.membershipId)}
                                onChange={() => toggleMemberSelection(target.membershipId)}
                              />
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="shrink-0"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <FavoriteButton
                                  active={target.favorite}
                                  onClick={() => void toggleFavorite(target)}
                                />
                              </span>
                              <MemberAvatar member={target} />
                              <b>{target.displayName}</b>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {[target.jobTitle, target.jobGradeName].filter(Boolean).join(" / ") ||
                              "-"}
                          </td>
                          <td className="px-4 py-3">{target.departmentName ?? "-"}</td>
                          <td className="px-4 py-3">{target.companyName}</td>
                          <td className="px-4 py-3">{target.email}</td>
                          <td className="px-4 py-3">{target.phoneNumber ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayMembers.length === 0 && (
                    <p className="p-12 text-center text-sm text-slate-500">
                      표시할 구성원이 없습니다.
                    </p>
                  )}
                </div>
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
              {/* 표 아래 선 밑의 고정 영역. 목록 길이와 상관없이 항상 같은 자리에 둠. */}
              <nav
                aria-label="구성원 목록 페이지"
                className="flex h-16 items-center justify-center gap-1.5 text-sm"
              >
                {memberTotal > 0 && (
                  <>
                    <button
                      disabled={page === 0}
                      aria-label="이전 페이지"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:opacity-30"
                      onClick={() => changePage(page - 1)}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    {visiblePages(page, totalPages).map((target) => (
                      <button
                        key={target}
                        aria-current={target === page ? "page" : undefined}
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full font-medium transition ${target === page ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                        onClick={() => changePage(target)}
                      >
                        {target + 1}
                      </button>
                    ))}
                    <button
                      disabled={page >= totalPages - 1}
                      aria-label="다음 페이지"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:opacity-30"
                      onClick={() => changePage(page + 1)}
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
              </nav>
            </>
          )}
        </section>
      </main>
      {toast && (
        <Toast key={toast.id} message={toast.message} phase={toast.phase} onClose={dismissToast} />
      )}
    </div>
  );
}

function AddressBookSearch({
  containerRef,
  keyword,
  isFocused,
  saveSearchEnabled,
  previewMembers,
  recentSearches,
  isPreviewLoading,
  showPreviewProfileImage,
  onChange,
  onFocus,
  onClear,
  onClearHistory,
  onDeleteHistory,
  onSaveToggle,
  onProfileImageToggle,
  onSearch,
  onLoadMore,
  onRecentSearchSelect,
  onPreviewSelect,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  keyword: string;
  isFocused: boolean;
  saveSearchEnabled: boolean;
  previewMembers: AddressBookMember[];
  recentSearches: AddressBookSearchHistory[];
  isPreviewLoading: boolean;
  showPreviewProfileImage: boolean;
  onChange: (keyword: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onClearHistory: () => void;
  onDeleteHistory: (searchHistoryId: number) => void;
  onSaveToggle: () => void;
  onProfileImageToggle: () => void;
  onSearch: () => void;
  onLoadMore: () => void;
  onRecentSearchSelect: (keyword: string) => void;
  onPreviewSelect: (member: AddressBookMember) => void;
}) {
  const hasKeyword = keyword.trim().length > 0;
  // 입력 중에는 최신 최근 검색어 세 개만 먼저 보여 구성원 결과를 가리지 않음.
  const matchingRecentSearches = hasKeyword
    ? recentSearches
        .filter((search) => search.keyword.toLowerCase().includes(keyword.trim().toLowerCase()))
        .slice(0, 3)
    : [];
  const handlePreviewScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 32) onLoadMore();
  };

  const resultHeightClassName = matchingRecentSearches.length > 0 ? "max-h-[228px]" : "max-h-52";

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[500px]">
      <label
        className={`flex h-10 items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-500 transition-shadow duration-200 ${isFocused ? "ring-2 ring-blue-500" : ""}`}
      >
        <Search size={18} />
        <input
          className="w-full bg-transparent text-sm outline-none"
          value={keyword}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={(event) => event.key === "Enter" && onSearch()}
          placeholder="이름, 이메일 검색"
        />
        {hasKeyword && (
          <button
            type="button"
            aria-label="검색어 지우기"
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-400 text-white transition hover:scale-110 hover:bg-slate-500 active:scale-90"
            onClick={onClear}
          >
            <X size={12} strokeWidth={3} />
          </button>
        )}
      </label>
      {isFocused && (
        <div className="absolute left-0 right-0 top-11 z-[80] overflow-hidden rounded-md bg-white text-sm text-slate-600 shadow-lg ring-1 ring-slate-200">
          <div
            className={`${resultHeightClassName} overflow-y-auto`}
            onScroll={handlePreviewScroll}
          >
            {hasKeyword ? (
              <>
                {matchingRecentSearches.map((search) => (
                  <div
                    key={search.id}
                    className="group flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <Clock3 size={16} className="shrink-0 text-slate-500" />
                    <button
                      className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium text-slate-800"
                      onClick={() => onRecentSearchSelect(search.keyword)}
                    >
                      <HighlightText value={search.keyword} keyword={keyword} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${search.keyword} 최근 검색어 삭제`}
                      className="invisible flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 group-hover:visible focus:visible"
                      onClick={() => onDeleteHistory(search.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {matchingRecentSearches.length > 0 && <div className="border-t border-slate-100" />}
                {isPreviewLoading && previewMembers.length === 0 ? (
                  <LoadingInline message="검색 중입니다." className="px-4 py-5" />
                ) : previewMembers.length ? (
                  <>
                    {previewMembers.map((target) => (
                      <button
                        key={target.membershipId}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
                        onClick={() => onPreviewSelect(target)}
                      >
                        {showPreviewProfileImage && <MemberAvatar member={target} />}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            <HighlightText value={target.displayName} keyword={keyword} />
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            <HighlightText
                              value={[
                                target.jobTitle,
                                target.jobGradeName,
                                target.departmentName,
                                target.companyName,
                                target.email,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              keyword={keyword}
                            />
                          </p>
                        </div>
                      </button>
                    ))}
                    {isPreviewLoading && (
                      <LoadingInline
                        message="검색 결과를 더 불러오는 중입니다."
                        size={12}
                        className="w-full justify-center px-4 py-2 text-xs text-slate-400"
                      />
                    )}
                  </>
                ) : matchingRecentSearches.length === 0 ? (
                  <p className="px-4 py-5">일치하는 구성원이 없습니다.</p>
                ) : null}
              </>
            ) : saveSearchEnabled && recentSearches.length ? (
              recentSearches.map((search) => (
                <div
                  key={search.id}
                  className="group flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <Clock3 size={16} className="shrink-0 text-slate-500" />
                  <button
                    className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium text-slate-800"
                    onClick={() => onRecentSearchSelect(search.keyword)}
                  >
                    {search.keyword}
                  </button>
                  <button
                    type="button"
                    aria-label={`${search.keyword} 최근 검색어 삭제`}
                    className="invisible flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 group-hover:visible focus:visible"
                    onClick={() => onDeleteHistory(search.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-4 py-5">
                {saveSearchEnabled ? "최근 검색어가 없습니다." : "검색어 저장 기능이 꺼져있습니다."}
              </p>
            )}
          </div>
          {hasKeyword ? (
            <div className="flex h-9 items-center justify-end gap-2 border-t border-slate-100 px-3 text-xs">
              프로필 이미지 표시{" "}
              <ToggleSwitch
                label="검색 미리보기 프로필 이미지 표시"
                enabled={showPreviewProfileImage}
                onToggle={onProfileImageToggle}
              />
            </div>
          ) : (
            <div className="flex h-9 items-center justify-between border-t border-slate-100 px-3 text-xs">
              {saveSearchEnabled ? (
                <button
                  className="cursor-pointer transition hover:text-blue-600"
                  onClick={onClearHistory}
                >
                  전체 삭제
                </button>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-2">
                검색어 저장{" "}
                <ToggleSwitch
                  label="검색어 저장"
                  enabled={saveSearchEnabled}
                  onToggle={onSaveToggle}
                />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-checked={enabled}
      role="switch"
      className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
      onClick={onToggle}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${enabled ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

function HighlightText({ value, keyword }: { value: string; keyword: string }) {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return value;
  const index = value.toLowerCase().indexOf(normalizedKeyword.toLowerCase());
  if (index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="bg-transparent font-bold text-blue-600">
        {value.slice(index, index + normalizedKeyword.length)}
      </mark>
      {value.slice(index + normalizedKeyword.length)}
    </>
  );
}

function SidebarIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex w-full cursor-pointer flex-col items-center gap-1 rounded-md py-2 text-xs text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

function CustomCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-label={label}
      aria-checked={checked}
      className="custom-checkbox-button flex h-7 w-7 cursor-pointer items-center justify-center rounded-md"
      onClick={onChange}
    >
      <span
        className={`custom-checkbox-control flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgb(219_234_254)]" : "border-slate-300 bg-white hover:border-blue-400"}`}
      >
        {checked && <Check className="checkbox-check-mark" size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

// 그룹 탭: 회사의 그룹 채팅방을 "전체 · 내가 속한 그룹 · 내가 마스터인 그룹"으로 나눠 보여 줌. 기본은 내가 속한 그룹.
type GroupTab = "all" | "joined" | "owner";
const groupTabs: { key: GroupTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "joined", label: "내가 속한 그룹" },
  { key: "owner", label: "내가 마스터인 그룹" },
];

const formatGroupDate = (value: string | null) => {
  if (!value) return "대화 없음";
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};

function GroupPanel({
  accessToken,
  showToast,
  onOpenRoom,
}: {
  accessToken: string | null;
  showToast: (message: string) => void;
  onOpenRoom: (roomId: number) => void;
}) {
  const [tab, setTab] = useState<GroupTab>("joined");
  const [groups, setGroups] = useState<ChatGroupSummary[] | null>(null);

  useEffect(() => {
    if (!accessToken) return;
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
  }, [accessToken, showToast]);

  const visible = (groups ?? []).filter((group) =>
    tab === "all" ? true : tab === "joined" ? group.joined : group.owner,
  );

  return (
    <div>
      <div className="mb-4 flex gap-5 border-b border-slate-200" role="tablist">
        {groupTabs.map(({ key, label }) => {
          const count =
            groups === null
              ? null
              : groups.filter((group) =>
                  key === "all" ? true : key === "joined" ? group.joined : group.owner,
                ).length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-1 pb-3 text-sm transition ${tab === key ? "border-blue-600 font-semibold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              onClick={() => setTab(key)}
            >
              {label}
              {count !== null && (
                <span
                  className={`text-xs font-bold ${tab === key ? "text-blue-600" : "text-slate-400"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {groups === null ? (
        <LoadingInline message="그룹 목록을 불러오는 중입니다." className="py-10 text-sm" />
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          {tab === "joined"
            ? "참여 중인 그룹이 없습니다."
            : tab === "owner"
              ? "내가 방장인 그룹이 없습니다."
              : "회사에 그룹 채팅방이 없습니다."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {visible.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() =>
                  group.joined
                    ? onOpenRoom(group.id)
                    : showToast("참여 중인 그룹만 열 수 있습니다. 방장에게 초대를 요청해 주세요.")
                }
                className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition ${group.joined ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UsersRound size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {group.name || "이름 없는 그룹"}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-blue-600">
                      {group.memberCount}
                    </span>
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
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    방장 {group.ownerName ?? "없음"} · 마지막 대화{" "}
                    {formatGroupDate(group.lastMessageAt)}
                  </span>
                </span>
                {group.joined && (
                  <MessageCircle size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberAvatar({
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

function MemberPanel({
  member,
  onClose,
  onToggleFavorite,
  onMessage,
  showToast,
}: {
  member: AddressBookMemberDetail;
  onClose: () => void;
  onToggleFavorite: () => void;
  onMessage: () => void;
  showToast: (message: string) => void;
}) {
  return (
    <aside className="relative w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <div className="flex justify-end gap-2">
        <button
          aria-label="프로필 상세 열기"
          className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          onClick={() => showToast("프로필 상세 기능은 준비 중입니다.")}
        >
          <ExternalLink size={20} />
        </button>
        <button
          aria-label="상세 패널 닫기"
          className="cursor-pointer rounded-md p-0 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <MemberAvatar member={member} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{member.displayName}</h2>
          <p className="text-sm text-slate-500">
            {[member.jobTitle, member.jobGradeName].filter(Boolean).join(" / ") || "직급 미지정"}
          </p>
        </div>
      </div>
      <span className="absolute right-4 top-[4.25rem]">
        <FavoriteButton active={member.favorite} onClick={onToggleFavorite} size="panel" />
      </span>
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
      <dl className="mt-6 space-y-4 text-sm">
        <Info label="소속" value={member.companyName} strong />
        <Info label="" value={member.departmentName ?? "부서 미지정"} />
        <Info label="전화" value={member.phoneNumber ?? "-"} />
        <Info label="이메일" value={member.email} />
        <Info label="입사일" value={member.hiredAt ?? "-"} />
      </dl>
    </aside>
  );
}

function Info({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="mb-1 text-xs text-slate-500">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
