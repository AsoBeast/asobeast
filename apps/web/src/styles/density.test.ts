import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const PRIMITIVES = join("components", "ui") + sep;

const OFF_SCALE =
  /\b(?:gap|gap-x|gap-y|space-y|space-x|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr)-(?:5|7|9|10|11|13|14|15)\b/g;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("density scale", () => {
  it("keeps spacing on the 4 8 12 16 24 32 steps outside the owned primitives", () => {
    const offenders = sources(ROOT).flatMap((path) => {
      if (path.includes(PRIMITIVES)) return [];
      const matches = readFileSync(path, "utf8").match(OFF_SCALE) ?? [];
      return matches.map((match) => `${path.slice(ROOT.length + 1)}: ${match}`);
    });

    expect(offenders).toEqual([]);
  });
});
