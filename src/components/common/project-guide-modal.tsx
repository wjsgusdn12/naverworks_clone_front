"use client";

import { ExternalLink, Server, MonitorSmartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoadingState } from "@/components/common/loading";

// 두 저장소의 README 다이어그램을 그대로 보여 주는 "프로젝트 소개" 모달.
// 그림과 설명은 각 저장소 docs/guide.json·docs/diagrams/*.svg 를 GitHub raw 주소로 읽는다.
// README를 고치고 scripts/build-diagrams.mjs 를 돌리면 이 모달도 같이 바뀐다(원본이 하나).

type GuideSection = {
  id: string;
  title: string;
  description: string;
  svg: string;
};

type GuideSource = {
  key: "backend" | "frontend";
  label: string;
  repo: string;
  icon: typeof Server;
};

const sources: GuideSource[] = [
  { key: "backend", label: "백엔드", repo: "naverworks_clone_api", icon: Server },
  { key: "frontend", label: "프론트", repo: "naverworks_clone_front", icon: MonitorSmartphone },
];

const rawBase = (repo: string) => `https://raw.githubusercontent.com/wjsgusdn12/${repo}/main/`;
const repoUrl = (repo: string) => `https://github.com/wjsgusdn12/${repo}#readme`;

type GuideState =
  { status: "loading" } | { status: "error" } | { status: "ready"; sections: GuideSection[] };

type ProjectGuideModalProps = {
  onClose: () => void;
};

export function ProjectGuideModal({ onClose }: ProjectGuideModalProps) {
  const [guides, setGuides] = useState<Record<GuideSource["key"], GuideState>>({
    backend: { status: "loading" },
    frontend: { status: "loading" },
  });
  // 좁은 화면에서는 두 열을 탭으로 전환.
  const [activeTab, setActiveTab] = useState<GuideSource["key"]>("backend");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    for (const source of sources) {
      fetch(`${rawBase(source.repo)}docs/guide.json`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((sections: GuideSection[]) =>
          setGuides((current) => ({ ...current, [source.key]: { status: "ready", sections } })),
        )
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setGuides((current) => ({ ...current, [source.key]: { status: "error" } }));
        });
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus(),
    );
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    // 뒤 화면 스크롤 잠금.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  const column = (source: GuideSource) => {
    const state = guides[source.key];
    const Icon = source.icon;
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Icon size={16} className="text-blue-600" aria-hidden="true" />
            {source.label}
            <span className="font-normal text-slate-400">{source.repo}</span>
          </h3>
          <a
            href={repoUrl(source.repo)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            GitHub에서 보기 <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {state.status === "loading" && (
            <LoadingState message="README 다이어그램을 불러오는 중입니다." className="h-40" />
          )}
          {state.status === "error" && (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              다이어그램을 불러오지 못했습니다. GitHub 접속 상태를 확인하거나{" "}
              <a
                href={repoUrl(source.repo)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                저장소 README
              </a>
              에서 직접 봐 주세요.
            </p>
          )}
          {state.status === "ready" && (
            <ol className="space-y-8">
              {state.sections.map((section, index) => (
                <li key={section.id} id={`guide-${source.key}-${section.id}`}>
                  <h4 className="mb-2 flex items-baseline gap-2 text-base font-bold text-slate-900">
                    <span className="text-xs font-semibold text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title.replace(/^\d+\.\s*/, "")}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white p-3">
                    {/* SVG는 GitHub raw에서 직접 읽어 README와 같은 파일을 보여 줌.
                        외부 SVG라 next/image 최적화 대상이 아니어서 일반 img를 사용. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${rawBase(source.repo)}${section.svg}`}
                      alt={section.title}
                      loading="lazy"
                      className="mx-auto h-auto max-w-full"
                    />
                  </div>
                  {section.description.split("\n").map((paragraph, paragraphIndex) => (
                    <p
                      key={paragraphIndex}
                      className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-600"
                    >
                      {paragraph}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="프로젝트 소개"
        className="message-action-menu flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">프로젝트 소개</h2>
            <p className="text-xs text-slate-500">
              두 저장소 README의 설계 다이어그램을 한 화면에서 봅니다. 왼쪽이 서버, 오른쪽이
              화면입니다.
            </p>
          </div>
          <button
            data-dialog-initial-focus
            type="button"
            aria-label="프로젝트 소개 닫기"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
        {/* 좁은 화면: 탭으로 한 열씩. */}
        <div className="flex border-b border-slate-200 lg:hidden" role="tablist">
          {sources.map((source) => (
            <button
              key={source.key}
              type="button"
              role="tab"
              aria-selected={activeTab === source.key}
              onClick={() => setActiveTab(source.key)}
              className={`flex-1 cursor-pointer py-2.5 text-sm font-semibold transition ${activeTab === source.key ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              {source.label}
            </button>
          ))}
        </div>
        {/* 넓은 화면: 가운데 선으로 나눈 두 열. */}
        <div className="flex min-h-0 flex-1">
          {sources.map((source, index) => (
            <div
              key={source.key}
              className={`${activeTab === source.key ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 lg:flex ${index === 1 ? "lg:border-l lg:border-slate-200" : ""}`}
            >
              {column(source)}
            </div>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
