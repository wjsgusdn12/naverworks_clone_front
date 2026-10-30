"use client";

import { LoadingState } from "@/components/common/loading";
import { fileIconOf, formatFileSize } from "@/lib/attachment-files";
import { Folder } from "lucide-react";
import { useEffect, useState } from "react";

type ZipEntry = { path: string; directory: boolean; size: number | null; date: Date };

// 압축 파일 안에 든 파일 목록(경로·크기·수정일). 내용을 풀어 보여 주지는 않음.
export function ZipPreview({ data }: { data: ArrayBuffer }) {
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    import("jszip")
      .then(({ default: JSZip }) => JSZip.loadAsync(data))
      .then((zip) => {
        const list = Object.values(zip.files).map((file) => ({
          path: file.name,
          directory: file.dir,
          // 압축 전 크기는 내부 정보라 공식 타입에 없음. 없으면 크기 칸을 비움.
          size:
            (file as unknown as { _data?: { uncompressedSize?: number } })._data
              ?.uncompressedSize ?? null,
          date: file.date,
        }));
        list.sort((a, b) => a.path.localeCompare(b.path));
        if (alive) setEntries(list);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [data]);

  if (failed)
    return (
      <p className="flex h-full items-center justify-center text-sm font-medium text-slate-600">
        [미리보기 실패] 압축 형식을 읽을 수 없음 · 내려받아 확인
      </p>
    );
  if (!entries)
    return <LoadingState message="압축 목록을 읽는 중입니다..." size="md" className="h-full" />;
  const fileCount = entries.filter((entry) => !entry.directory).length;
  return (
    <div className="h-full overflow-auto bg-white">
      <p className="sticky top-0 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs text-slate-500">
        파일 {fileCount}개 · 폴더 {entries.length - fileCount}개
      </p>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => {
          const depth = entry.path.replace(/\/$/, "").split("/").length - 1;
          const name = entry.path.replace(/\/$/, "").split("/").pop() ?? entry.path;
          const { Icon, className } = fileIconOf(name);
          return (
            <li
              key={entry.path}
              className="flex items-center gap-2 px-5 py-1.5 text-sm"
              style={{ paddingLeft: 20 + depth * 18 }}
            >
              {entry.directory ? (
                <Folder size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
              ) : (
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${className}`}
                >
                  <Icon size={13} aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-slate-800" title={entry.path}>
                {name}
              </span>
              {!entry.directory && entry.size !== null && (
                <span className="shrink-0 text-xs text-slate-400">
                  {formatFileSize(entry.size)}
                </span>
              )}
              <span className="w-24 shrink-0 text-right text-xs text-slate-400">
                {entry.date.toLocaleDateString("ko-KR")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
