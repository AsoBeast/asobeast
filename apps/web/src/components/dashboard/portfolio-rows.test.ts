import { describe, expect, it } from "vitest";
import type { PortfolioApp, PortfolioAppInsight } from "@asobeast/shared";
import {
  filterRows,
  matchesQuery,
  orderMembers,
  sortRows,
  toRows,
  type PortfolioRow,
} from "./portfolio-rows";

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
    lastCapturedAt: "2026-09-28T03:00:00.000Z",
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

function insight(
  appId: string,
  overrides: Partial<PortfolioAppInsight> = {},
): PortfolioAppInsight {
  return {
    appId,
    rankDistribution: {
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 0,
    },
    top10Delta7d: null,
    movement: { up: 0, down: 0, entered: 0, lost: 0 },
    rating: { average: null, count: null, averageDelta7d: null },
    audit: null,
    actions: null,
    changes7d: { own: 0, competitors: 0 },
    negativeReviews7d: 0,
    ...overrides,
  };
}

const ids = (rows: PortfolioRow[]): string[] =>
  rows.map((row) => (row.kind === "app" ? row.app.id : row.id));

const SERVER_ORDER = [
  app({
    id: "high",
    name: "Zen",
    storeAppId: "1",
    visibility: { current: 60, delta7d: 2 },
  }),
  app({
    id: "mid",
    name: "Alpha",
    storeAppId: "2",
    visibility: { current: 30, delta7d: -4 },
  }),
  app({
    id: "tie",
    name: "Beta",
    storeAppId: "3",
    visibility: { current: 30, delta7d: null },
  }),
  app({
    id: "low",
    name: "Gamma",
    storeAppId: "4",
    visibility: { current: 5, delta7d: 9 },
  }),
];

describe("sortRows", () => {
  it("keeps the server order for the default sort", () => {
    const rows = toRows(SERVER_ORDER);

    expect(
      ids(sortRows(rows, { sort: "visibility", dir: null }, new Map())),
    ).toEqual(["high", "mid", "tie", "low"]);
  });

  it("sorts names ascending unless told otherwise", () => {
    const rows = toRows(SERVER_ORDER);

    expect(ids(sortRows(rows, { sort: "name", dir: null }, new Map()))).toEqual(
      ["mid", "tie", "low", "high"],
    );
    expect(
      ids(sortRows(rows, { sort: "name", dir: "desc" }, new Map())),
    ).toEqual(["high", "low", "tie", "mid"]);
  });

  it("puts apps without an insight value last in both directions", () => {
    const rows = toRows(SERVER_ORDER);
    const insights = new Map([
      [
        "mid",
        insight("mid", {
          rating: { average: 4.8, count: 10, averageDelta7d: null },
        }),
      ],
      [
        "low",
        insight("low", {
          rating: { average: 3.9, count: 10, averageDelta7d: null },
        }),
      ],
      ["high", insight("high")],
    ]);

    expect(
      ids(sortRows(rows, { sort: "rating", dir: null }, insights)),
    ).toEqual(["mid", "low", "high", "tie"]);
    expect(
      ids(sortRows(rows, { sort: "rating", dir: "asc" }, insights)),
    ).toEqual(["low", "mid", "high", "tie"]);
    expect(
      ids(sortRows(rows, { sort: "change", dir: null }, insights)),
    ).toEqual(["low", "high", "mid", "tie"]);
  });

  it("sorts a group by its best member", () => {
    const rows = toRows([
      app({
        id: "solo",
        name: "Solo",
        storeAppId: "9",
        visibility: { current: 40, delta7d: null },
      }),
      app({ id: "us", name: "Timer", storeAppId: "1", country: "us" }),
      app({ id: "de", name: "Timer", storeAppId: "1", country: "de" }),
    ]);
    const insights = new Map([
      ["solo", insight("solo", { actions: { open: 3, critical: 0, high: 0 } })],
      ["us", insight("us", { actions: { open: 1, critical: 0, high: 0 } })],
      ["de", insight("de", { actions: { open: 7, critical: 0, high: 0 } })],
    ]);

    expect(
      ids(sortRows(rows, { sort: "actions", dir: null }, insights)),
    ).toEqual(["APP_STORE:1", "solo"]);
    expect(
      ids(sortRows(rows, { sort: "visibility", dir: null }, insights)),
    ).toEqual(["solo", "APP_STORE:1"]);
  });

  it("sorts a group by its lowest member when ascending", () => {
    const rows = toRows([
      app({
        id: "solo",
        name: "Solo",
        storeAppId: "9",
        visibility: { current: 50, delta7d: null },
      }),
      app({
        id: "us",
        name: "Timer",
        storeAppId: "1",
        country: "us",
        visibility: { current: 90, delta7d: null },
      }),
      app({
        id: "de",
        name: "Timer",
        storeAppId: "1",
        country: "de",
        visibility: { current: 2, delta7d: null },
      }),
    ]);

    expect(
      ids(sortRows(rows, { sort: "visibility", dir: "asc" }, new Map())),
    ).toEqual(["APP_STORE:1", "solo"]);
    expect(
      ids(sortRows(rows, { sort: "visibility", dir: null }, new Map())),
    ).toEqual(["APP_STORE:1", "solo"]);
  });

  it("gives an app awaiting its first run no insight value", () => {
    const rows = toRows([
      app({
        id: "pending",
        name: "Pending",
        storeAppId: "1",
        lastCapturedAt: null,
      }),
      app({ id: "live", name: "Live", storeAppId: "2" }),
    ]);
    const insights = new Map([
      ["pending", insight("pending")],
      [
        "live",
        insight("live", {
          rankDistribution: {
            top1: 0,
            top3: 0,
            top10: 1,
            top50: 1,
            beyond: 0,
            unranked: 0,
          },
        }),
      ],
    ]);

    expect(
      ids(sortRows(rows, { sort: "top10", dir: "asc" }, insights)),
    ).toEqual(["live", "pending"]);
  });

  it("leaves the member order of a group alone", () => {
    const rows = toRows([
      app({ id: "us", name: "Timer", storeAppId: "1", country: "us" }),
      app({ id: "de", name: "Timer", storeAppId: "1", country: "de" }),
    ]);

    const [group] = sortRows(rows, { sort: "name", dir: "desc" }, new Map());

    expect(group.kind === "group" && group.members.map((m) => m.id)).toEqual([
      "us",
      "de",
    ]);
  });
});

describe("matchesQuery", () => {
  const tomato = app({
    id: "gp",
    name: "Tomato Clock",
    store: "GOOGLE_PLAY",
    country: "de",
  });

  it.each([
    ["the name", "tomato"],
    ["the country code", "DE"],
    ["the store label", "google"],
    ["an empty query", "  "],
  ])("matches %s", (_label, query) => {
    expect(matchesQuery(tomato, query)).toBe(true);
  });

  it("ignores accents on either side", () => {
    expect(matchesQuery(app({ id: "h", name: "Habit Tracker" }), "habít")).toBe(
      true,
    );
    expect(matchesQuery(app({ id: "c", name: "Café Timer" }), "cafe")).toBe(
      true,
    );
  });

  it("rejects an app that matches nothing", () => {
    expect(matchesQuery(tomato, "habit")).toBe(false);
  });

  it("keeps a whole group when any member matches", () => {
    const rows = toRows([
      app({ id: "a", groupId: "g", groupName: "Focus", name: "Focus iOS" }),
      app({
        id: "b",
        groupId: "g",
        groupName: "Focus",
        name: "Focus Play",
        country: "fr",
      }),
      app({ id: "c", name: "Other", storeAppId: "7" }),
    ]);

    const [group, ...rest] = filterRows(rows, "fr");

    expect(rest).toEqual([]);
    expect(group.kind === "group" && group.members).toHaveLength(2);
    expect(ids(filterRows(rows, "focus"))).toEqual(["g"]);
  });
});
