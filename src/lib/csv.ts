/** Minimal RFC 4180 parser: quoted fields, "" escapes, CRLF/LF, optional UTF-8 BOM. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
  return rows;
}

export type Cell = string | number | null | undefined;

function escapeCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Spreadsheet formula injection: a text cell starting with = + - @ (or tab/CR) would be executed by Excel.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text with a UTF-8 BOM so Excel shows Uzbek/Cyrillic letters correctly. */
export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(rows: Cell[][], filename: string): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
