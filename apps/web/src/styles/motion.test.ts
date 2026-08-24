import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const MIN_MS = 150;
const MAX_MS = 300;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") || entry.name.endsWith(".css")
      ? [path]
      : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sources(ROOT).flatMap((path) => {
    const matches = readFileSync(path, "utf8").match(pattern) ?? [];
    return matches.map((match) => `${path.slice(ROOT.length + 1)}: ${match}`);
  });
}

describe("motion budget", () => {
  it("never transitions every property", () => {
    expect(offenders(/\btransition-all\b|transition:\s*all\b/g)).toEqual([]);
  });

  it("keeps every duration between 150 and 300 milliseconds", () => {
    const durations = offenders(/\bduration-(\d+)\b/g).filter((entry) => {
      const ms = Number(/duration-(\d+)/.exec(entry)?.[1]);
      return ms < MIN_MS || ms > MAX_MS;
    });

    expect(durations).toEqual([]);
  });
});
