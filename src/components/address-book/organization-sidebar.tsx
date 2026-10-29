"use client";

import { SidebarIcon } from "@/components/address-book/sidebar-icon";
import type { AddressBookOrganization } from "@/lib/api/address-book-api";
import { Building2, ChevronDown, ChevronRight, Star, UsersRound } from "lucide-react";

export type AddressBookView = "favorite" | "group" | "company" | "department";

export function OrganizationSidebar({
  isCollapsed,
  view,
  organizations,
  companyId,
  departmentId,
  isOrganizationExpanded,
  expandedCompanyIds,
  showToast,
  onSelectView,
  onToggleOrganizationExpanded,
  onToggleCompanyExpanded,
  onSelectCompany,
  onSelectDepartment,
}: {
  isCollapsed: boolean;
  view: AddressBookView;
  organizations: AddressBookOrganization[];
  companyId: number | null;
  departmentId: number | null;
  isOrganizationExpanded: boolean;
  expandedCompanyIds: number[];
  showToast: (message: string) => void;
  onSelectView: (view: AddressBookView) => void;
  onToggleOrganizationExpanded: () => void;
  onToggleCompanyExpanded: (companyId: number) => void;
  onSelectCompany: (companyId: number) => void;
  onSelectDepartment: (companyId: number, departmentId: number) => void;
}) {
  return (
    <aside
      className={`shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50 transition-[width] duration-300 ease-out ${isCollapsed ? "w-20 p-2" : "w-64 p-3"}`}
    >
      {isCollapsed ? (
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
            onClick={() => onSelectView("company")}
          />
          <SidebarIcon
            label="즐겨찾기"
            icon={<Star size={20} />}
            onClick={() => onSelectView("favorite")}
          />
          <SidebarIcon
            label="그룹"
            icon={<UsersRound size={20} />}
            onClick={() => onSelectView("group")}
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
              onClick={() => onSelectView("favorite")}
            >
              <Star className="mx-auto mb-1" size={18} />
              즐겨찾기
            </button>
            <button
              className={`cursor-pointer rounded-md py-2 ${view === "group" ? "text-blue-600" : "text-slate-600"}`}
              onClick={() => onSelectView("group")}
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
                onClick={() => onToggleOrganizationExpanded()}
              >
                {isOrganizationExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
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
                        onClick={() => onToggleCompanyExpanded(organization.companyId)}
                      >
                        {isCompanyExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-3 text-left"
                        onClick={() => onSelectCompany(organization.companyId)}
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
                          onClick={() => onSelectDepartment(organization.companyId, department.id)}
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
  );
}
