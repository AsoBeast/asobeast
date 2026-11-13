import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TYPE_STEPS } from "@/lib/utils";
import { declarations } from "./token-scope";

const scale = declarations(
  readFileSync(join(import.meta.dirname, "typography.css"), "utf8"),
  "@theme",
);

const STEPS = [
  "hero",
  "metric",
  "title",
  "dialog",
  "body",
  "dense",
  "label",
  "tick",
] as const;

function rem(step: (typeof STEPS)[number]): number {
  return Number.parseFloat(scale[`--text-${step}`] ?? "");
}

describe("the type scale", () => {
  it("sets a heading at body size and a label at caption size, told apart by weight", () => {
    expect(scale["--text-heading"]).toBe(scale["--text-body"]);
    expect(scale["--text-heading--font-weight"]).toBe("600");
    expect(scale["--text-caption"]).toBe(scale["--text-label"]);
    expect(scale["--text-label--font-weight"]).toBe("500");
    expect(scale["--text-label--letter-spacing"]).toBeUndefined();
  });

  it("declares the hero step above the metric step", () => {
    expect(scale["--text-hero"]).toBe("2.25rem");
    expect(scale["--text-hero--line-height"]).toBe("1.1");
    expect(scale["--text-hero--letter-spacing"]).toBe("-0.024em");
    expect(scale["--text-hero--font-weight"]).toBe("600");
  });

  it("runs from hero down to tick without a step out of order", () => {
    const sizes = STEPS.map(rem);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(STEPS.length);
  });

  it("teaches the class merger every step of the scale", () => {
    const declared = Object.keys(scale)
      .filter((name) => !name.includes("--", 2))
      .map((name) => name.replace("--text-", ""));
    expect([...TYPE_STEPS].sort()).toEqual(declared.sort());
  });
});
