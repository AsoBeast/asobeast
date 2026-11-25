import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets a type step replace a primitive's font size", () => {
    expect(cn("text-base leading-snug", "text-title")).toBe("text-title");
    expect(cn("text-sm text-foreground", "text-heading")).toBe(
      "text-foreground text-heading",
    );
  });

  it("lets a later font size replace an earlier line height", () => {
    expect(cn("text-sm leading-none", "text-base")).toBe("text-base");
    expect(cn("leading-6", "text-caption")).toBe("text-caption");
  });

  it("keeps a line height set after the font size", () => {
    expect(cn("text-title", "leading-snug")).toBe("text-title leading-snug");
  });

  it("keeps a type step beside a text colour", () => {
    expect(cn("text-hero", "text-muted-foreground")).toBe(
      "text-hero text-muted-foreground",
    );
  });
});
