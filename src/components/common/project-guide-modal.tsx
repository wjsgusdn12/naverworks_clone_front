"use client";

import {
  ExternalLink,
  Minus,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  Server,
  X,
  ZoomIn,
} from "lucide-react";
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
  // 확대 보기 중인 그림. view는 배율(1 = 화면에 맞춤)과 드래그로 옮긴 위치(px).
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  // 드래그 중에는 transform 전환 효과를 꺼서 손에 바로 따라오게 함.
  const [dragging, setDragging] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const zoomAreaRef = useRef<HTMLDivElement>(null);
  // 드래그 중 마지막 포인터 위치. 렌더링과 무관하므로 ref.
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const openZoom = (target: { src: string; alt: string } | null) => {
    setZoomed(target);
    setView({ scale: 1, x: 0, y: 0 });
  };

  const clampScale = (value: number) => Math.min(5, Math.max(0.5, value));

  // 휠: 위로 굴리면 확대, 아래로 굴리면 축소. 커서가 가리키는 지점이 제자리에 머물도록 위치를 보정.
  // 페이지 스크롤을 막아야 해서 passive: false 로 직접 등록.
  useEffect(() => {
    const area = zoomAreaRef.current;
    if (!zoomed || !area) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = area.getBoundingClientRect();
      const pointX = event.clientX - rect.left - rect.width / 2;
      const pointY = event.clientY - rect.top - rect.height / 2;
      setView((current) => {
        const next = clampScale(current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
        const ratio = next / current.scale;
        return {
          scale: next,
          x: pointX - (pointX - current.x) * ratio,
          y: pointY - (pointY - current.y) * ratio,
        };
      });
    };
    area.addEventListener("wheel", handleWheel, { passive: false });
    return () => area.removeEventListener("wheel", handleWheel);
  }, [zoomed]);

  useEffect(() => {
    const controller = new AbortController();
    for (const source of sources) {
      // 브라우저 캐시를 쓰지 않아 README를 고쳐 푸시하면 바로 반영(GitHub raw 자체 캐시는 몇 분 남을 수 있음).
      fetch(`${rawBase(source.repo)}docs/guide.json`, {
        signal: controller.signal,
        cache: "no-store",
      })
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
    // 뒤 화면 스크롤 잠금.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  // Esc: 확대 보기가 열려 있으면 그것부터 닫고, 아니면 모달을 닫음.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (zoomed) setZoomed(null);
      else onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [zoomed, onClose]);

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
                  {/* 그림을 누르면 전체 화면 확대 보기. */}
                  <button
                    type="button"
                    onClick={() =>
                      openZoom({ src: `${rawBase(source.repo)}${section.svg}`, alt: section.title })
                    }
                    aria-label={`${section.title} 그림 확대`}
                    className="group/figure block w-full cursor-zoom-in overflow-x-auto rounded-xl border border-slate-100 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-md"
                  >
                    {/* SVG는 GitHub raw에서 직접 읽어 README와 같은 파일을 보여 줌.
                        외부 SVG라 next/image 최적화 대상이 아니어서 일반 img를 사용. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${rawBase(source.repo)}${section.svg}`}
                      alt={section.title}
                      loading="lazy"
                      className="mx-auto h-auto max-w-full"
                    />
                    <span className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-400 opacity-0 transition group-hover/figure:opacity-100">
                      <ZoomIn size={12} aria-hidden="true" /> 클릭해서 크게 보기
                    </span>
                  </button>
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
        className="message-action-menu flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
      {/* 그림 확대 보기: 어두운 배경 위에 크게, +·− 로 배율 조절, 바깥 클릭·Esc로 닫음. */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.alt} 확대 보기`}
          className="fixed inset-0 z-[120] flex flex-col bg-slate-950/85 animate-in fade-in duration-150"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) openZoom(null);
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="truncate text-sm font-semibold">{zoomed.alt}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="축소"
                onClick={() =>
                  setView((current) => ({ ...current, scale: clampScale(current.scale - 0.25) }))
                }
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-white/80">
                {Math.round(view.scale * 100)}%
              </span>
              <button
                type="button"
                aria-label="확대"
                onClick={() =>
                  setView((current) => ({ ...current, scale: clampScale(current.scale + 0.25) }))
                }
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                aria-label="원래 크기"
                onClick={() => setView({ scale: 1, x: 0, y: 0 })}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <RotateCcw size={15} />
              </button>
              <button
                data-zoom-close
                type="button"
                aria-label="확대 보기 닫기"
                onClick={() => openZoom(null)}
                className="ml-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {/* 그림 영역: 휠로 확대·축소, 누른 채 끌어서 이동. 그림 밖 빈 곳을 누르면 닫힘. */}
          <div
            ref={zoomAreaRef}
            className="relative min-h-0 flex-1 touch-none overflow-hidden"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              if (event.target === event.currentTarget) {
                openZoom(null);
                return;
              }
              dragRef.current = { x: event.clientX, y: event.clientY };
              setDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const last = dragRef.current;
              if (!last) return;
              const dx = event.clientX - last.x;
              const dy = event.clientY - last.y;
              dragRef.current = { x: event.clientX, y: event.clientY };
              setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
            }}
            onPointerUp={(event) => {
              dragRef.current = null;
              setDragging(false);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setDragging(false);
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center p-4"
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transition: dragging ? "none" : "transform 80ms ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomed.src}
                alt={zoomed.alt}
                draggable={false}
                className="pointer-events-auto max-h-full max-w-full cursor-grab select-none rounded-lg bg-white p-4 shadow-2xl active:cursor-grabbing"
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
