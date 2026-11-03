import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { declarations } from "./token-scope";

const scale = declarations(
  readFileSync(join(import.meta.dirname, "typography.css"), "utf8"),
  "@theme",
);

const STEPS = [
  "hero",
  "display",
  "title",
  "subtitle",
  "body",
  "caption",
] as const;

function rem(step: (typeof STEPS)[number]): number {
  return Number.parseFloat(scale[`--text-${step}`] ?? "");
}

describe("the type scale", () => {
  it("declares the hero step above the display step", () => {
    expect(scale["--text-hero"]).toBe("2.25rem");
    expect(scale["--text-hero--line-height"]).toBe("1.1");
    expect(scale["--text-hero--letter-spacing"]).toBe("-0.024em");
    expect(scale["--text-hero--font-weight"]).toBe("600");
  });

  it("runs from hero down to caption without a step out of order", () => {
    const sizes = STEPS.map(rem);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(STEPS.length);
  });
});
