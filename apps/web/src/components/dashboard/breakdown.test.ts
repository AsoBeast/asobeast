import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import type {
  PortfolioApp,
  PortfolioAppInsight,
  PortfolioHistory,
  PortfolioPartChange,
  Store,
} from "@asobeast/shared";
import {
  appLabel,
  BREAKDOWN_LIMIT,
  breakdownBy,
  breakdownRows,
  breakdownSize,
  historyScope,
  isBrokenDown,
  leavesWithScope,
  rowLabel,
  rowSize,
  scopeId,
  shownRows,
  sortRows,
  type BreakdownRow,
} from "./breakdown";

const t = translationContext("en", "dashboard").translator;

const app = (
  id: string,
  name: string,
  store: Store = "APP_STORE",
  country = "us",
): PortfolioApp => ({
  id,
  store,
  storeAppId: id,
  country,
  name,
  iconUrl: null,
  groupId: null,
  groupName: null,
  visibility: { current: 0, delta7d: null },
  sparkline: [],
  trackedKeywords: 0,
  competitors: 0,
  lastCapturedAt: null,
});

const part = (
  rest: Partial<PortfolioPartChange> = {},
): PortfolioPartChange => ({
  visibility: 40,
  visibilityDelta: 0,
  top10: 3,
  top10Delta: 0,
  movement: { up: 0, down: 0, entered: 0, lost: 0 },
  ...rest,
});

const insight = (
  appId: string,
  open: number,
  critical: number,
): PortfolioAppInsight => ({
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
  actions: { open, critical, high: 0 },
  changes7d: { own: 0, competitors: 0 },
  negativeReviews7d: 0,
});

const checked = (listed: PortfolioApp): PortfolioApp => ({
  ...listed,
  lastCapturedAt: "2026-07-01T00:00:00.000Z",
});

const APPS = [
  checked(app("a", "Focus Timer")),
  checked(app("b", "Focus Timer", "APP_STORE", "de")),
  checked(app("c", "Tomato Clock", "GOOGLE_PLAY", "de")),
];

const ONE_STORE = APPS.slice(0, 2);

const history = (rest: Partial<PortfolioHistory>): PortfolioHistory => ({
  days: 30,
  points: [],
  previous: [],
  change: {
    compared: false,
    visibilityDelta: null,
    top10Delta: null,
    movement: { up: 0, down: 0, entered: 0, lost: 0 },
    appsMoved: 0,
    movers: { up: [], down: [] },
  },
  ...rest,
});

const row = (id: string, rest: Partial<BreakdownRow> = {}): BreakdownRow => ({
  id,
  name: id,
  mark: "",
  shortMark: "",
  change: part(),
  open: 0,
  critical: 0,
  ...rest,
});

describe("historyScope", () => {
  it("scopes to a known app and ignores an unknown one", () => {
    expect(historyScope("app", "b", APPS)).toEqual({ appId: "b" });
    expect(historyScope("app", "elsewhere", APPS)).toEqual({});
  });

  it("scopes to a store only while the breakdown is by store", () => {
    expect(historyScope("store", "GOOGLE_PLAY", APPS)).toEqual({
      store: "GOOGLE_PLAY",
    });
    expect(historyScope("store", "b", APPS)).toEqual({});
    expect(historyScope("app", "GOOGLE_PLAY", APPS)).toEqual({});
  });

  it("reads a store breakdown as apps while the checked apps share one store", () => {
    const pending = [...ONE_STORE, app("p", "Pending", "GOOGLE_PLAY")];

    expect(breakdownBy("store", APPS)).toBe("store");
    expect(breakdownBy("store", ONE_STORE)).toBe("app");
    expect(breakdownBy("store", pending)).toBe("app");
    expect(historyScope("store", "APP_STORE", ONE_STORE)).toEqual({});
    expect(historyScope("store", "b", ONE_STORE)).toEqual({ appId: "b" });
  });

  it("answers no scope without one, and names the scope it answers", () => {
    expect(historyScope("app", null, APPS)).toEqual({});
    expect(scopeId({})).toBeNull();
    expect(scopeId({ appId: "b" })).toBe("b");
    expect(scopeId({ store: "APP_STORE" })).toBe("APP_STORE");
  });
});

describe("appLabel", () => {
  it("adds the storefront only where two apps share a name", () => {
    expect(appLabel(APPS[1], APPS, t)).toBe("Focus Timer (DE)");
    expect(appLabel(APPS[2], APPS, t)).toBe("Tomato Clock");
    expect(appLabel({ ...APPS[2], name: null }, APPS, t)).toBe("Untitled app");
  });
});

describe("breakdownRows", () => {
  const insights = new Map([
    ["a", insight("a", 5, 1)],
    ["b", insight("b", 2, 0)],
  ]);
  const answered = history({
    apps: [
      {
        appId: "a",
        points: [],
        change: part({ visibilityDelta: 5 }),
        lastRun: { up: 0, down: 0, entered: 0, lost: 0 },
      },
      {
        appId: "gone",
        points: [],
        change: part(),
        lastRun: { up: 0, down: 0, entered: 0, lost: 0 },
      },
    ],
    stores: [{ store: "APP_STORE", apps: 2, change: part({ top10: 9 }) }],
  });

  it("names each app with its store and storefront and its open actions", () => {
    expect(breakdownRows(answered, APPS, insights, { by: "app", t })).toEqual([
      {
        id: "a",
        name: "Focus Timer",
        mark: "App Store · US",
        shortMark: "iOS · US",
        iconUrl: null,
        change: part({ visibilityDelta: 5 }),
        open: 5,
        critical: 1,
      },
    ]);
  });

  it("pools the open actions of a store's apps", () => {
    expect(breakdownRows(answered, APPS, insights, { by: "store", t })).toEqual(
      [
        {
          id: "APP_STORE",
          name: "App Store",
          mark: "2 apps",
          shortMark: "2 apps",
          change: part({ top10: 9 }),
          open: 7,
          critical: 1,
        },
      ],
    );
  });

  it("answers no rows for a history without a breakdown", () => {
    expect(
      breakdownRows(history({}), APPS, insights, { by: "app", t }),
    ).toEqual([]);
    expect(
      breakdownRows(history({}), APPS, insights, { by: "store", t }),
    ).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = [
    row("steady"),
    row("fell", { change: part({ visibilityDelta: -7, top10Delta: 1 }) }),
    row("rose", {
      change: part({
        visibilityDelta: 4,
        top10Delta: -3,
        movement: { up: 6, down: 2, entered: 0, lost: 0 },
      }),
      open: 9,
    }),
    row("urgent", { open: 1, critical: 1 }),
  ];
  const order = (metric: Parameters<typeof sortRows>[1]) =>
    sortRows(rows, metric).map(({ id }) => id);

  it("puts the largest change first whichever way it went", () => {
    expect(order("visibility")).toEqual(["fell", "rose", "steady", "urgent"]);
    expect(order("top10")).toEqual(["rose", "fell", "steady", "urgent"]);
    expect(order("moved")).toEqual(["rose", "fell", "steady", "urgent"]);
  });

  it("puts critical actions before a longer queue", () => {
    expect(order("actions")).toEqual(["urgent", "rose", "fell", "steady"]);
  });

  it("sizes a row by the figure the tab shows", () => {
    expect(rowSize(rows[1], "visibility")).toBe(7);
    expect(rowSize(rows[2], "top10")).toBe(3);
    expect(rowSize(rows[2], "moved")).toBe(8);
    expect(rowSize(rows[2], "actions")).toBe(9);
    expect(
      rowSize(
        row("new", { change: part({ visibilityDelta: null }) }),
        "visibility",
      ),
    ).toBe(0);
  });
});

describe("shownRows", () => {
  const many = Array.from({ length: BREAKDOWN_LIMIT + 3 }, (_, index) =>
    row(`row-${index}`),
  );

  it("shows every row of a list one longer than the limit", () => {
    expect(shownRows(many.slice(0, BREAKDOWN_LIMIT + 1), null)).toHaveLength(
      BREAKDOWN_LIMIT + 1,
    );
  });

  it("says which scoped row leaves the list once its scope is released", () => {
    const beyond = `row-${BREAKDOWN_LIMIT + 2}`;

    expect(leavesWithScope(many, beyond)).toBe(true);
    expect(leavesWithScope(many, "row-0")).toBe(false);
    expect(
      leavesWithScope(
        many.slice(0, BREAKDOWN_LIMIT + 1),
        `row-${BREAKDOWN_LIMIT}`,
      ),
    ).toBe(false);
  });

  it("cuts a longer list to the limit and keeps the scoped row", () => {
    expect(shownRows(many, null)).toHaveLength(BREAKDOWN_LIMIT);
    expect(
      shownRows(many, `row-${BREAKDOWN_LIMIT + 2}`).map(({ id }) => id),
    ).toEqual([
      ...many.slice(0, BREAKDOWN_LIMIT).map(({ id }) => id),
      `row-${BREAKDOWN_LIMIT + 2}`,
    ]);
  });
});

describe("rowLabel", () => {
  const named = row("a", {
    name: "Focus Timer",
    mark: "App Store · US",
    shortMark: "iOS · US",
    open: 5,
    critical: 1,
    change: part({
      visibility: 62.4,
      visibilityDelta: 10.4,
      top10: 4,
      top10Delta: -1,
      movement: { up: 3, down: 1, entered: 0, lost: 0 },
    }),
  });

  it("reads the row with spaces between its parts and the figures of the tab", () => {
    expect(rowLabel(named, "visibility", "30d", t)).toBe(
      "Focus Timer iOS · US, App Store · US, 62 now, +10 30d",
    );
    expect(rowLabel(named, "top10", "7d", t)).toBe(
      "Focus Timer iOS · US, App Store · US, 4 now, -1 7d",
    );
    expect(rowLabel(named, "moved", "30d", t)).toBe(
      "Focus Timer iOS · US, App Store · US, 3 climbing, 1 falling",
    );
    expect(rowLabel(named, "actions", "30d", t)).toBe(
      "Focus Timer iOS · US, App Store · US, 5 open, 1 critical",
    );
  });

  it("starts with the words the row shows and names a store row once", () => {
    const store = row("APP_STORE", {
      name: "App Store",
      mark: "2 apps",
      shortMark: "2 apps",
      open: 3,
    });

    expect(rowLabel(named, "actions", "30d", t)).toMatch(
      /^Focus Timer iOS · US,/,
    );
    expect(rowLabel(store, "actions", "30d", t)).toBe(
      "App Store 2 apps, 3 open",
    );
  });

  it("words a change that cannot be compared and a queue without a critical action", () => {
    const fresh = row("b", {
      name: "Habit Tracker",
      mark: "App Store · US",
      shortMark: "iOS · US",
      open: 2,
      change: part({ visibility: 10, visibilityDelta: null }),
    });
    expect(rowLabel(fresh, "visibility", "30d", t)).toBe(
      "Habit Tracker iOS · US, App Store · US, 10 now, no 30d data",
    );
    expect(rowLabel(fresh, "actions", "30d", t)).toBe(
      "Habit Tracker iOS · US, App Store · US, 2 open",
    );
  });
});

describe("Simplified Chinese dashboard breakdown", () => {
  it("localizes spoken row figures and app counts", () => {
    const t = translationContext("zh-CN", "dashboard").translator;
    const named = row("a", {
      name: "Focus Timer",
      mark: "App Store · US",
      shortMark: "iOS · US",
      open: 5,
      critical: 1,
      change: part({
        visibility: 62.4,
        visibilityDelta: 10.4,
        top10: 4,
        top10Delta: -1,
        movement: { up: 3, down: 1, entered: 0, lost: 0 },
      }),
    });

    expect(rowLabel(named, "visibility", "30 天", t)).toBe(
      "Focus Timer iOS · US，App Store · US，当前 62，30 天 +10",
    );
    expect(rowLabel(named, "moved", "30 天", t)).toBe(
      "Focus Timer iOS · US，App Store · US，3 个上升，1 个下降",
    );
    expect(rowLabel(named, "actions", "30 天", t)).toBe(
      "Focus Timer iOS · US，App Store · US，5 个待处理，1 个紧急",
    );
    expect(
      breakdownRows(
        history({
          stores: [{ store: "APP_STORE", apps: 2, change: part({ top10: 9 }) }],
        }),
        APPS,
        new Map(),
        { by: "store", t },
      )[0]?.mark,
    ).toBe("2 个应用");
  });
});

describe("breakdownSize", () => {
  const listed = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      checked(app(`app-${index}`, "App")),
    );

  it("counts the checked apps the list will show", () => {
    expect(breakdownSize([...listed(3), app("pending", "Pending")])).toBe(3);
    expect(breakdownSize(listed(BREAKDOWN_LIMIT + 1))).toBe(
      BREAKDOWN_LIMIT + 1,
    );
    expect(breakdownSize(listed(BREAKDOWN_LIMIT + 5))).toBe(BREAKDOWN_LIMIT);
  });

  it("leaves the list out for a portfolio of one checked app", () => {
    const one = {
      appId: "a",
      points: [],
      change: part(),
      lastRun: { up: 0, down: 0, entered: 0, lost: 0 },
    };

    expect(breakdownSize([...listed(1), app("pending", "Pending")])).toBe(0);
    expect(breakdownSize([])).toBe(0);
    expect(isBrokenDown(history({ apps: [one] }))).toBe(false);
    expect(isBrokenDown(history({ apps: [one, { ...one, appId: "b" }] }))).toBe(
      true,
    );
    expect(isBrokenDown(history({}))).toBe(false);
  });
});
