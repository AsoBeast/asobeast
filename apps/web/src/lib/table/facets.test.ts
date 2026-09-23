import { describe, expect, it } from "vitest";
import { oneOf, statusFilter } from "./facets";

describe("oneOf", () => {
  it("keeps a value that is selected", () => {
    expect(oneOf("TITLE", ["TITLE", "MANUAL"])).toBe(true);
  });

  it("drops a value that is not selected", () => {
    expect(oneOf("SUBTITLE", ["TITLE", "MANUAL"])).toBe(false);
  });

  it("never keeps a missing value", () => {
    expect(oneOf(undefined, ["TITLE"])).toBe(false);
  });
});

describe("statusFilter", () => {
  const active = { active: true };
  const paused = { active: false };

  it("keeps only active rows for active", () => {
    expect(statusFilter(active, "active")).toBe(true);
    expect(statusFilter(paused, "active")).toBe(false);
  });

  it("keeps only paused rows for paused", () => {
    expect(statusFilter(active, "paused")).toBe(false);
    expect(statusFilter(paused, "paused")).toBe(true);
  });

  it("keeps every row for all", () => {
    expect(statusFilter(active, "all")).toBe(true);
    expect(statusFilter(paused, "all")).toBe(true);
  });
});
