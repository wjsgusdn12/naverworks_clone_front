import type { CSSProperties } from "react";

// 엑셀형 격자 미리보기의 공통 모양. xlsx(exceljs)와 csv(직접 해석) 모두 이 형태로 바꿔 그림.
export type GridCell = {
  text: string;
  style?: CSSProperties;
  rowSpan?: number;
  colSpan?: number;
  // 병합된 칸에 덮여 그리지 않는 칸.
  covered?: boolean;
};
export type GridSheet = {
  name: string;
  rows: GridCell[][];
  columnCount: number;
  // 픽셀 단위. 모르면 기본 폭.
  columnWidths: number[];
  rowHeights: (number | undefined)[];
  // 너무 커서 앞부분만 담았는지.
  truncated: boolean;
};

// 화면이 멈추지 않도록 시트마다 이만큼만 그림.
export const MAX_PREVIEW_ROWS = 1000;
export const MAX_PREVIEW_COLUMNS = 100;
const DEFAULT_COLUMN_WIDTH = 96;

// 1 → A, 27 → AA (엑셀 열 이름).
export const columnName = (index: number) => {
  let name = "";
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
};

// "B3" → { row: 3, column: 2 }
const parseAddress = (address: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(address.replace(/\$/g, ""));
  if (!match) return null;
  const column = [...match[1]].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
  return { row: Number(match[2]), column };
};

// "FFRRGGBB" → "#RRGGBB". 테마 색처럼 값이 없으면 undefined.
const argbColor = (argb: string | undefined) =>
  argb && /^[0-9A-Fa-f]{8}$/.test(argb) ? `#${argb.slice(2)}` : undefined;

type ExcelCellLike = {
  text: string;
  font?: {
    bold?: boolean;
    italic?: boolean;
    underline?: unknown;
    strike?: boolean;
    color?: { argb?: string };
  };
  fill?: { type?: string; pattern?: string; fgColor?: { argb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
};

// 셀 서식 중 화면에서 흉내 낼 수 있는 것만 옮김(굵게·기울임·밑줄·취소선·글자색·배경색·정렬·줄바꿈).
const cellStyle = (cell: ExcelCellLike): CSSProperties | undefined => {
  const style: CSSProperties = {};
  const font = cell.font;
  if (font?.bold) style.fontWeight = 700;
  if (font?.italic) style.fontStyle = "italic";
  const decorations = [font?.underline ? "underline" : "", font?.strike ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");
  if (decorations) style.textDecoration = decorations;
  const color = argbColor(font?.color?.argb);
  if (color) style.color = color;
  if (cell.fill?.type === "pattern" && cell.fill.pattern === "solid") {
    const background = argbColor(cell.fill.fgColor?.argb);
    if (background) style.backgroundColor = background;
  }
  const horizontal = cell.alignment?.horizontal;
  if (horizontal === "center" || horizontal === "right" || horizontal === "left")
    style.textAlign = horizontal;
  if (cell.alignment?.wrapText) style.whiteSpace = "pre-wrap";
  return Object.keys(style).length > 0 ? style : undefined;
};

// xlsx 파일을 시트별 격자로 바꿈. 라이브러리는 미리보기를 열 때만 불러옴.
export const loadXlsxSheets = async (data: ArrayBuffer): Promise<GridSheet[]> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheets: GridSheet[] = [];
  workbook.eachSheet((worksheet) => {
    // 숨긴 시트는 엑셀처럼 탭에 보이지 않게 함.
    if (worksheet.state !== "visible") return;
    const rowCount = Math.min(worksheet.rowCount, MAX_PREVIEW_ROWS);
    const columnCount = Math.min(Math.max(worksheet.columnCount, 1), MAX_PREVIEW_COLUMNS);
    const rows: GridCell[][] = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, () => ({ text: "" })),
    );
    for (let r = 1; r <= rowCount; r += 1) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= columnCount; c += 1) {
        const cell = row.getCell(c);
        rows[r - 1][c - 1] = { text: cell.text ?? "", style: cellStyle(cell as ExcelCellLike) };
      }
    }
    // 병합: 왼쪽 위 칸에 범위를 주고 나머지 칸은 덮인 칸으로 표시.
    const merges = (worksheet.model as { merges?: string[] }).merges ?? [];
    for (const range of merges) {
      const [from, to] = range.split(":").map(parseAddress);
      if (!from || !to || from.row > rowCount || from.column > columnCount) continue;
      const lastRow = Math.min(to.row, rowCount);
      const lastColumn = Math.min(to.column, columnCount);
      for (let r = from.row; r <= lastRow; r += 1)
        for (let c = from.column; c <= lastColumn; c += 1) rows[r - 1][c - 1].covered = true;
      const master = rows[from.row - 1][from.column - 1];
      master.covered = false;
      master.rowSpan = lastRow - from.row + 1;
      master.colSpan = lastColumn - from.column + 1;
    }
    sheets.push({
      name: worksheet.name,
      rows,
      columnCount,
      // 엑셀 열 너비(글자 수 단위)를 대략 픽셀로 바꿈.
      columnWidths: Array.from({ length: columnCount }, (_, index) => {
        const width = worksheet.getColumn(index + 1).width;
        return width ? Math.round(width * 7 + 5) : DEFAULT_COLUMN_WIDTH;
      }),
      // 행 높이(포인트)를 픽셀로 바꿈.
      rowHeights: Array.from({ length: rowCount }, (_, index) => {
        const height = worksheet.getRow(index + 1).height;
        return height ? Math.round((height * 4) / 3) : undefined;
      }),
      truncated:
        worksheet.rowCount > MAX_PREVIEW_ROWS || worksheet.columnCount > MAX_PREVIEW_COLUMNS,
    });
  });
  return sheets;
};

// CSV 글자를 격자로 바꿈. 따옴표 안의 쉼표·줄바꿈과 "" 이스케이프를 처리(RFC 4180).
export const parseCsvSheet = (text: string, name: string): GridSheet => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let truncated = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (records.length >= MAX_PREVIEW_ROWS) {
        truncated = i < source.length - 1;
        break;
      }
    } else field += char;
  }
  if (!truncated && (field || record.length > 0)) {
    record.push(field);
    records.push(record);
  }
  const widest = records.reduce((max, item) => Math.max(max, item.length), 1);
  const columnCount = Math.min(widest, MAX_PREVIEW_COLUMNS);
  return {
    name,
    rows: records.map((item) =>
      Array.from({ length: columnCount }, (_, index) => ({ text: item[index] ?? "" })),
    ),
    columnCount,
    columnWidths: Array.from({ length: columnCount }, () => 120),
    rowHeights: [],
    truncated: truncated || widest > MAX_PREVIEW_COLUMNS,
  };
};
