import { describe, expect, it } from "vitest";
import { resolveCssVariables } from "./css-variables";

const TOKENS: Record<string, string> = {
  "--chart-1": "oklch(0.52 0.15 240)",
  "--color-kw": "var(--chart-1)",
  "--border": "hsl(210 14% 89%)",
  "--loop": "var(--loop)",
  "--blank": "  ",
};

const lookup = (name: string) => TOKENS[name] ?? null;

describe("resolveCssVariables", () => {
  it.each([
    ["var(--chart-1)", "oklch(0.52 0.15 240)"],
    ["var(--color-kw)", "oklch(0.52 0.15 240)"],
    ["var(--border)", "hsl(210 14% 89%)"],
    ["var( --border )", "hsl(210 14% 89%)"],
    ["var(--missing, red)", "red"],
    ["var(--missing, var(--border))", "hsl(210 14% 89%)"],
    ["var(--missing, var(--also-missing, 1px))", "1px"],
    ["var(--blank, blue)", "blue"],
    ["var(--missing, oklch(0.5, 0.1, 240))", "oklch(0.5, 0.1, 240)"],
    [
      "color-mix(in oklab, var(--chart-1) 50%, transparent)",
      "color-mix(in oklab, oklch(0.52 0.15 240) 50%, transparent)",
    ],
    ["1px solid var(--border)", "1px solid hsl(210 14% 89%)"],
    ["var(--chart-1) var(--border)", "oklch(0.52 0.15 240) hsl(210 14% 89%)"],
    ["red", "red"],
  ])("turns %s into %s", (input, expected) => {
    expect(resolveCssVariables(input, lookup)).toBe(expected);
  });

  it.each([
    ["var(--missing)", "var(--missing)"],
    ["a var(--missing) b var(--border)", "a var(--missing) b hsl(210 14% 89%)"],
    ["var(--loop)", "var(--loop)"],
    ["var(--chart-1", "var(--chart-1"],
  ])("leaves %s readable when nothing resolves it", (input, expected) => {
    expect(resolveCssVariables(input, lookup)).toBe(expected);
  });
});
