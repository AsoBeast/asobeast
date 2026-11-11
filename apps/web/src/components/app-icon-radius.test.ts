import { describe, expect, it } from "vitest";
import { iconRadius } from "./app-icon-radius";

describe("iconRadius", () => {
  it("rounds an icon in proportion to its size", () => {
    expect(iconRadius(48)).toBe(11);
    expect(iconRadius(24)).toBe(5);
  });

  it("never rounds a small icon below four pixels", () => {
    expect(iconRadius(16)).toBe(4);
  });
});
