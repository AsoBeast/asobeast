import { downloadBlob } from "./download-blob";

function escapeField(value: string | number | null): string {
  if (value === null) {
    return "";
  }
  const raw = String(value);
  const text =
    typeof value === "string" && /^[=+\-@\t\r\n]/.test(value)
      ? `'${value}`
      : raw;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>,
): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeField).join(","));
  return "﻿" + lines.join("\r\n");
}

export function csvFilename(prefix: string, ...parts: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${[prefix, ...parts, today].join("-")}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
