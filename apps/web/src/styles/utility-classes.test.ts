import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|decoration|outline|shadow|from|via|to)-(?:white|black|zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b(?!\/)/g;

const DANGLING_MODIFIER = /\s\/\d+(?=["'\s])/g;

const COLOUR_TOKENS = [
  ...readFileSync(join(import.meta.dirname, "semantic.css"), "utf8").matchAll(
    /^\s*--([\w-]+):/gm,
  ),
].map(([, name]) => name);

const TRANSLUCENT_TEXT = new RegExp(
  `\\btext-(?:${COLOUR_TOKENS.join("|")})\\/\\d+`,
  "g",
);

const RETIRED_TYPE_STEP = /\btext-(?:display|subtitle|numeric)\b/g;

const TRANSLUCENT_RING = /\bring-ring\/\d+/g;

const MONOSPACE_NUMBER =
  /["'`][^"'`\n]*\b(?:numeric\b[^"'`\n]*\bfont-mono|font-mono\b[^"'`\n]*\bnumeric)\b[^"'`\n]*["'`]/g;

const THICKENING_LINK =
  /\bdecoration-faint-foreground\b[^"'`\n]*\bhover:decoration-2\b/g;

const POINTER_CURSOR = /\bcursor-pointer\b/g;

const POINTER_ON_A_NON_BUTTON = [
  "components/keywords/ImportFileStep.tsx: cursor-pointer",
  "components/keywords/map/zone-layers.tsx: cursor-pointer",
];

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

  it("draws text in a token colour rather than a translucent one", () => {
    expect(offenders(TRANSLUCENT_TEXT)).toEqual([]);
  });

  it("darkens a link underline on hover rather than thickening it", () => {
    expect(offenders(THICKENING_LINK)).toEqual([]);
  });

  it("leaves no opacity modifier detached from its utility", () => {
    expect(offenders(DANGLING_MODIFIER)).toEqual([]);
  });

  it("sizes text with a step the type scale still declares", () => {
    expect(offenders(RETIRED_TYPE_STEP)).toEqual([]);
  });

  it("draws every focus ring solid", () => {
    expect(offenders(TRANSLUCENT_RING)).toEqual([]);
  });

  it("leaves the pointer cursor of a button to the base layer", () => {
    expect(offenders(POINTER_CURSOR).sort()).toEqual(POINTER_ON_A_NON_BUTTON);
  });

  it("sets a number in tabular figures rather than monospace", () => {
    expect(offenders(MONOSPACE_NUMBER)).toEqual([]);
  });
});
