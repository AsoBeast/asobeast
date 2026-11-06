import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets a type step replace a primitive's font size", () => {
    expect(cn("text-base leading-snug", "text-title")).toBe("text-title");
    expect(cn("text-sm text-foreground", "text-heading")).toBe(
      "text-foreground text-heading",
    );
  });

  it("keeps a type step beside a text colour", () => {
    expect(cn("text-hero", "text-muted-foreground")).toBe(
      "text-hero text-muted-foreground",
    );
  });
});
