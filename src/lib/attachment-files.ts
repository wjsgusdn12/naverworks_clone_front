import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react";

// 첨부 제한. 서버(application.yml)와 같은 값을 유지해 올리기 전에 미리 안내.
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 10;
// 입력창·미리보기 칸·끌어 놓기 화면에 공통으로 보여 주는 제한 안내.
export const ATTACHMENT_LIMIT_LABEL = `파일당 최대 ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB · 한 번에 최대 ${MAX_ATTACHMENT_COUNT}개`;
// 서버가 사진으로 인정하는 형식. 이미지 버튼의 파일 선택 창에도 이 형식만 보여 줌.
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

// 1536 → "1.5KB"처럼 읽기 쉬운 크기.
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, "")}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, "")}MB`;
};

// 미리보기 칸에서 썸네일을 보여 줄지 판단(실제 사진 여부는 서버가 내용으로 다시 판별).
export const isPreviewableImage = (file: File) => IMAGE_ACCEPT.split(",").includes(file.type);

const extensionIcons: [string[], LucideIcon, string][] = [
  [["zip", "7z", "rar", "tar", "gz", "alz", "egg"], FileArchive, "text-amber-600 bg-amber-50"],
  [["xls", "xlsx", "csv", "cell"], FileSpreadsheet, "text-emerald-600 bg-emerald-50"],
  [["ppt", "pptx", "key", "show"], Presentation, "text-orange-600 bg-orange-50"],
  [["pdf"], FileText, "text-red-600 bg-red-50"],
  [["doc", "docx", "hwp", "hwpx", "txt", "md", "rtf"], FileText, "text-blue-600 bg-blue-50"],
  [
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"],
    FileImage,
    "text-violet-600 bg-violet-50",
  ],
  [["mp4", "mov", "avi", "mkv", "webm"], FileVideo, "text-pink-600 bg-pink-50"],
  [["mp3", "wav", "m4a", "flac", "ogg"], FileAudio, "text-cyan-600 bg-cyan-50"],
  [
    ["js", "ts", "tsx", "java", "py", "json", "xml", "html", "css", "sql"],
    FileCode,
    "text-slate-700 bg-slate-100",
  ],
];

// 확장자별 아이콘과 색. 모르는 형식은 기본 문서 아이콘.
export const fileIconOf = (name: string): { Icon: LucideIcon; className: string } => {
  const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const found = extensionIcons.find(([extensions]) => extensions.includes(extension));
  return found
    ? { Icon: found[1], className: found[2] }
    : { Icon: FileIcon, className: "text-slate-500 bg-slate-100" };
};

// 브라우저 기본 기능만으로 열어 볼 수 있는 형식. 서버는 파일을 항상 다운로드 형식으로 주므로
// 화면에서 확장자에 맞는 형식을 다시 붙여 보여 줌. HTML·SVG는 실행되지 않게 글자로만 보여 줌.
export type FilePreviewKind = "pdf" | "text" | "video" | "audio";
const textExtensions = [
  "txt",
  "md",
  "csv",
  "log",
  "json",
  "xml",
  "yml",
  "yaml",
  "js",
  "jsx",
  "ts",
  "tsx",
  "java",
  "py",
  "sql",
  "css",
  "html",
  "htm",
  "svg",
  "sh",
  "properties",
  "ini",
  "env",
  "kt",
  "c",
  "cpp",
  "h",
];
const mediaTypes: Record<string, [FilePreviewKind, string]> = {
  pdf: ["pdf", "application/pdf"],
  mp4: ["video", "video/mp4"],
  webm: ["video", "video/webm"],
  mp3: ["audio", "audio/mpeg"],
  wav: ["audio", "audio/wav"],
  ogg: ["audio", "audio/ogg"],
  m4a: ["audio", "audio/mp4"],
};
// 글자 미리보기는 너무 큰 파일이면 화면이 멈출 수 있어 2MB까지만.
export const TEXT_PREVIEW_MAX = 2 * 1024 * 1024;

export const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

// 미리보기 방식과 붙일 형식. 지원하지 않으면 null.
export const filePreviewOf = (name: string): { kind: FilePreviewKind; mime: string } | null => {
  const extension = extensionOf(name);
  if (textExtensions.includes(extension)) return { kind: "text", mime: "text/plain" };
  const media = mediaTypes[extension];
  return media ? { kind: media[0], mime: media[1] } : null;
};

// 받은 Blob을 원래 파일 이름으로 내 컴퓨터에 저장.
export const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 다운로드가 시작될 시간을 준 뒤 메모리 정리.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
