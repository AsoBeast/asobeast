import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|decoration|outline|shadow|from|via|to)-(?:white|black|zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b(?!\/)/g;

const DANGLING_MODIFIER = /\s\/\d+(?=["'\s])/g;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sources(ROOT).flatMap((path) => {
    const matches = readFileSync(path, "utf8").match(pattern) ?? [];
    return matches.map((match) => `${path.slice(ROOT.length + 1)}: ${match}`);
  });
}

describe("utility classes", () => {
  it("paints every opaque surface with a semantic token", () => {
    expect(offenders(PALETTE)).toEqual([]);
  });

  it("leaves no opacity modifier detached from its utility", () => {
    expect(offenders(DANGLING_MODIFIER)).toEqual([]);
  });
});
