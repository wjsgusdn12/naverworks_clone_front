"use client";

import { SidebarIcon } from "@/components/address-book/sidebar-icon";
import type { AddressBookOrganization } from "@/lib/api/address-book-api";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  Star,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type AddressBookView = "favorite" | "group" | "company" | "department";

export function OrganizationSidebar({
  isCollapsed,
  view,
  organizations,
  companyId,
  departmentId,
  isOrganizationExpanded,
  expandedCompanyIds,
  onCreateCompany,
  onCreateGroupRoom,
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
  // "새로 만들기" 메뉴: 회사 만들기(만든 사람이 대표로 이동) / 그룹 채팅방 만들기
  onCreateCompany: () => void;
  onCreateGroupRoom: () => void;
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
          <CreateMenu
            onCreateCompany={onCreateCompany}
            onCreateGroupRoom={onCreateGroupRoom}
            trigger={(toggle, open) => (
              <button
                aria-label="새로 만들기"
                aria-expanded={open}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-950 text-2xl text-white transition hover:scale-105 active:scale-95"
                onClick={toggle}
              >
                +
              </button>
            )}
          />
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
          <CreateMenu
            onCreateCompany={onCreateCompany}
            onCreateGroupRoom={onCreateGroupRoom}
            trigger={(toggle, open) => (
              <button
                aria-expanded={open}
                className="mb-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800"
                onClick={toggle}
              >
                새로 만들기{" "}
                <ChevronDown className={`ml-1 transition ${open ? "rotate-180" : ""}`} size={15} />
              </button>
            )}
          />
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

// "새로 만들기" 드롭다운. 버튼 모양은 호출하는 쪽이 정하고, 메뉴와 바깥 클릭 닫기는 여기서 처리.
function CreateMenu({
  trigger,
  onCreateCompany,
  onCreateGroupRoom,
}: {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  onCreateCompany: () => void;
  onCreateGroupRoom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = [
    { label: "그룹 채팅방 만들기", icon: MessageSquarePlus, onClick: onCreateGroupRoom },
    { label: "회사 만들기", icon: Building2, onClick: onCreateCompany },
  ];

  return (
    <div ref={rootRef} className="relative">
      {trigger(() => setOpen((current) => !current), open)}
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-800 shadow-lg"
        >
          {items.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onClick();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-100"
            >
              <Icon size={16} className="text-slate-500" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
