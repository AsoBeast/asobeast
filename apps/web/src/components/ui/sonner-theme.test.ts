import { describe, expect, it } from "vitest";
import { resolveToasterTheme } from "./sonner-theme";

describe("resolveToasterTheme", () => {
  it.each([undefined, "unexpected"])("falls back to system for %s", (theme) => {
    expect(resolveToasterTheme(theme)).toBe("system");
  });

  it.each(["light", "dark", "system"])("preserves %s", (theme) => {
    expect(resolveToasterTheme(theme)).toBe(theme);
  });
});
