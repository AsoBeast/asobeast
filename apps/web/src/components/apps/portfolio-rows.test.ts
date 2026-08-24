import { describe, expect, it } from "vitest";
import type { PortfolioApp } from "@asobeast/shared";
import { orderMembers, toRows } from "./portfolio-rows";

function app(overrides: Partial<PortfolioApp> & { id: string }): PortfolioApp {
  return {
    store: "APP_STORE",
    storeAppId: "1",
    country: "us",
    name: "App",
    iconUrl: null,
    groupId: null,
    groupName: null,
    visibility: { current: 0, delta7d: null },
    sparkline: [],
    trackedKeywords: 0,
    competitors: 0,
    lastCapturedAt: null,
    ...overrides,
  };
}

describe("toRows", () => {
  it("keeps an unrelated app as its own row", () => {
    const rows = toRows([app({ id: "a", storeAppId: "1" })]);
    expect(rows).toEqual([
      { kind: "app", app: expect.objectContaining({ id: "a" }) },
    ]);
  });

  it("groups the same storefront listing across countries", () => {
    const rows = toRows([
      app({ id: "a", storeAppId: "1", country: "us" }),
      app({ id: "b", storeAppId: "1", country: "de" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", variant: "storefront" });
  });

  it("does not group the same store id across different stores", () => {
    const rows = toRows([
      app({ id: "a", storeAppId: "1", store: "APP_STORE" }),
      app({ id: "b", storeAppId: "1", store: "GOOGLE_PLAY" }),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(["app", "app"]);
  });

  it("groups linked apps under their group name", () => {
    const rows = toRows([
      app({ id: "a", groupId: "g1", groupName: "Focus", storeAppId: "1" }),
      app({
        id: "b",
        groupId: "g1",
        groupName: "Focus",
        store: "GOOGLE_PLAY",
        storeAppId: "2",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "group",
      variant: "linked",
      name: "Focus",
    });
  });

  it("keeps linked and ungrouped apps in one list", () => {
    const rows = toRows([
      app({ id: "a", groupId: "g1", groupName: "Focus" }),
      app({ id: "b", storeAppId: "9" }),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(["group", "app"]);
  });
});

describe("orderMembers", () => {
  it("puts the app store before google play, then sorts by country", () => {
    const ordered = orderMembers([
      app({ id: "c", store: "GOOGLE_PLAY", country: "de" }),
      app({ id: "b", store: "APP_STORE", country: "de" }),
      app({ id: "a", store: "APP_STORE", country: "at" }),
    ]);

    expect(ordered.map((member) => member.id)).toEqual(["a", "b", "c"]);
  });
});
