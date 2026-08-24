import { describe, expect, it } from "vitest";
import {
  APP_SECTIONS,
  appRouteFrom,
  equivalentSection,
  isSectionActive,
  sectionHref,
} from "./app-sections";

describe("appRouteFrom", () => {
  it("reads the app id and the overview segment", () => {
    expect(appRouteFrom("/apps/app-1")).toEqual({ id: "app-1", segment: "" });
    expect(appRouteFrom("/apps/app-1/")).toEqual({ id: "app-1", segment: "" });
  });

  it("reads a section segment", () => {
    expect(appRouteFrom("/apps/app-1/keywords")).toEqual({
      id: "app-1",
      segment: "keywords",
    });
  });

  it("ignores workspace routes", () => {
    expect(appRouteFrom("/")).toBeNull();
    expect(appRouteFrom("/actions")).toBeNull();
    expect(appRouteFrom("/settings")).toBeNull();
  });
});

describe("sectionHref", () => {
  it("keeps the overview at the app root", () => {
    expect(sectionHref("app-1", "")).toBe("/apps/app-1");
    expect(sectionHref("app-1", "rankings")).toBe("/apps/app-1/rankings");
  });
});

describe("isSectionActive", () => {
  it("marks only the overview active at the app root", () => {
    expect(isSectionActive("/apps/app-1", "app-1", "")).toBe(true);
    for (const { segment } of APP_SECTIONS.filter((s) => s.segment !== "")) {
      expect(isSectionActive("/apps/app-1", "app-1", segment)).toBe(false);
    }
  });

  it("does not mark the overview active on a section route", () => {
    expect(isSectionActive("/apps/app-1/keywords", "app-1", "")).toBe(false);
    expect(isSectionActive("/apps/app-1/keywords", "app-1", "keywords")).toBe(
      true,
    );
  });

  it("never matches another app", () => {
    expect(isSectionActive("/apps/app-2/keywords", "app-1", "keywords")).toBe(
      false,
    );
  });

  it("never matches a section whose name prefixes another", () => {
    expect(isSectionActive("/apps/app-1/actions", "app-1", "action")).toBe(
      false,
    );
  });
});

describe("equivalentSection", () => {
  it("keeps a known section when switching app", () => {
    expect(equivalentSection("rankings")).toBe("rankings");
  });

  it("falls back to the overview for a section that does not carry over", () => {
    expect(equivalentSection("setup")).toBe("");
    expect(equivalentSection("")).toBe("");
  });
});
