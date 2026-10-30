"use client";

import { LoadingInline } from "@/components/common/loading";
import { HighlightText } from "@/components/address-book/highlight-text";
import { MemberAvatar } from "@/components/address-book/member-avatar";
import { ToggleSwitch } from "@/components/address-book/toggle-switch";
import type { AddressBookMember, AddressBookSearchHistory } from "@/lib/api/address-book-api";
import { Clock3, Search, X } from "lucide-react";
import type { RefObject, UIEvent } from "react";

export function AddressBookSearch({
  containerRef,
  keyword,
  isFocused,
  saveSearchEnabled,
  previewMembers,
  recentSearches,
  isRecentSearchLoading = false,
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
  // 최근 검색어를 불러오는 중이면 "없습니다" 대신 로딩 표시.
  isRecentSearchLoading?: boolean;
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
            ) : saveSearchEnabled && isRecentSearchLoading && recentSearches.length === 0 ? (
              <LoadingInline message="최근 검색어를 불러오는 중입니다." className="px-4 py-5" />
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
