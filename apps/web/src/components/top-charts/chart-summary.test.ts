import { describe, expect, it } from "vitest";
import type { ChartAppLink, ChartEntryItem, ChartPage } from "@asobeast/shared";
import {
  chartHistory,
  chartLede,
  historyDates,
  historyReady,
  movementCounts,
  movementText,
  ownStanding,
  trackedRows,
  type LedePart,
} from "./chart-summary";

function entry(
  position: number,
  previous: number | null,
  overrides: Partial<ChartEntryItem> = {},
): ChartEntryItem {
  const delta = previous === null ? null : position - previous;
  return {
    position,
    storeAppId: `app-${position}`,
    title: `App ${position}`,
    developer: null,
    iconUrl: null,
    genreId: null,
    genreName: null,
    free: true,
    previous,
    delta,
    movement:
      delta === null ? "new" : delta < 0 ? "up" : delta > 0 ? "down" : "same",
    ...overrides,
  };
}

const OWN: ChartAppLink = {
  storeAppId: "app-3",
  appId: "own-1",
  primaryAppId: null,
  name: "Mine",
  role: "own",
};

const RIVAL: ChartAppLink = {
  storeAppId: "app-2",
  appId: "rival-1",
  primaryAppId: "own-1",
  name: "Mine",
  role: "competitor",
};

type Summary = Parameters<typeof chartLede>[0][number];

function page(
  collection: ChartPage["chart"]["collection"],
  overrides: Partial<Summary> = {},
): Summary {
  return {
    chart: {
      store: "APP_STORE",
      country: "us",
      collection,
      genre: "6014",
      genreName: "Games",
      device: "iphone",
    },
    capture: {
      date: "2026-11-12",
      depth: 100,
      capturedAt: "2026-11-12T03:10:00.000Z",
    },
    comparison: {
      date: "2026-11-11",
      depth: 100,
      capturedAt: "2026-11-11T03:10:00.000Z",
    },
    entries: [entry(1, 3), entry(2, 1), entry(3, 3), entry(4, null)],
    apps: [OWN, RIVAL],
    dates: ["2026-11-12", "2026-11-11"],
    ...overrides,
  };
}

const text = (parts: LedePart[]) => parts.map((part) => part.text).join("");

describe("movementCounts", () => {
  it("counts each kind of move and ignores an uncompared entry", () => {
    const counts = movementCounts([
      entry(1, 3),
      entry(2, 1),
      entry(3, 3),
      entry(4, null),
      entry(5, null, { movement: "none" }),
    ]);
    expect(counts).toEqual({ climbed: 1, entered: 1, held: 1, fell: 1 });
    expect(movementText(counts)).toBe("1 climbed, 1 new, 1 held, 1 fell");
  });
});

describe("ownStanding", () => {
  it("finds the own app in the first chart that lists it", () => {
    const standing = ownStanding([
      page("free", { apps: [RIVAL] }),
      page("paid"),
    ]);
    expect(standing?.collection).toBe("paid");
    expect(standing?.entry.position).toBe(3);
  });

  it("is null when no own app is listed", () => {
    expect(ownStanding([page("free", { apps: [RIVAL] })])).toBeNull();
  });
});

describe("chartLede", () => {
  it("says where the own app holds and what moved across the charts", () => {
    expect(text(chartLede([page("free"), page("paid")], null))).toBe(
      "App 3 holds #3 in Free, unchanged since Nov 11. Across two charts 2 apps climbed, 2 fell and 2 entered.",
    );
  });

  it("says how far the own app climbed in one chart", () => {
    const entries = [entry(1, 2), entry(2, 1), entry(3, 5)];
    expect(text(chartLede([page("free", { entries })], null))).toBe(
      "App 3 climbed 2 to #3 in Free since Nov 11. 2 apps climbed and 1 fell.",
    );
  });

  it("says a fall and an entry", () => {
    const fell = [entry(3, 1)];
    expect(text(chartLede([page("free", { entries: fell })], null))).toBe(
      "App 3 fell 2 to #3 in Free since Nov 11. 1 app fell.",
    );
    const entered = [entry(3, null)];
    expect(text(chartLede([page("free", { entries: entered })], null))).toBe(
      "App 3 entered Free at #3 since Nov 11. 1 app entered.",
    );
  });

  it("dates the counts when no own app is listed", () => {
    expect(text(chartLede([page("free", { apps: [] })], null))).toBe(
      "None of your apps is in this chart. 1 app climbed, 1 fell and 1 entered since Nov 11.",
    );
  });

  it("says nothing moved", () => {
    const entries = [entry(1, 1), entry(3, 3)];
    expect(text(chartLede([page("free", { entries })], null))).toBe(
      "App 3 holds #3 in Free, unchanged since Nov 11. Nothing moved since Nov 11.",
    );
  });

  it("leaves movement out without a comparison", () => {
    const entries = [entry(3, null, { movement: "none" })];
    expect(
      text(chartLede([page("free", { entries, comparison: null })], null)),
    ).toBe("App 3 is #3 in Free.");
  });

  it("says a category was never captured or has no capture that day", () => {
    const never = page("free", { capture: null, dates: [], entries: [] });
    expect(text(chartLede([never], null))).toBe(
      "Games in United States has not been captured yet.",
    );
    const missing = page("free", { capture: null, entries: [] });
    expect(text(chartLede([missing], "2026-11-09"))).toBe(
      "Games in United States has no capture on Nov 9, 2026.",
    );
  });

  it("names how many charts the counts cover and dates the own app by its own chart", () => {
    const paid = page("paid", {
      apps: [],
      comparison: {
        date: "2026-11-10",
        depth: 100,
        capturedAt: "2026-11-10T03:10:00.000Z",
      },
    });
    const uncompared = page("grossing", { apps: [], comparison: null });
    const uncaptured = page("grossing", { capture: null, entries: [] });
    expect(text(chartLede([page("free"), paid, uncompared], null))).toBe(
      "App 3 holds #3 in Free, unchanged since Nov 11. Across two charts 2 apps climbed, 2 fell and 2 entered.",
    );
    expect(text(chartLede([paid, page("free"), uncaptured], null))).toContain(
      "unchanged since Nov 11. Across two charts",
    );
    expect(text(chartLede([page("free"), uncompared, uncaptured], null))).toBe(
      "App 3 holds #3 in Free, unchanged since Nov 11. 1 app climbed, 1 fell and 1 entered.",
    );
  });

  it("marks the app name so it is isolated and never translated", () => {
    const [name] = chartLede([page("free")], null);
    expect(name).toEqual({ text: "App 3", strong: true, app: true });
  });

  it("marks the figures as strong", () => {
    const strong = chartLede([page("free")], null)
      .filter((part) => part.strong)
      .map((part) => part.text);
    expect(strong).toEqual([
      "App 3",
      " holds #3",
      "1 app climbed",
      "1 fell",
      "1 entered",
    ]);
  });
});

describe("trackedRows", () => {
  it("lists a tracked app once with its place in every chart", () => {
    const paid = page("paid", {
      entries: [entry(7, 9, { storeAppId: "app-3" })],
    });
    const rows = trackedRows([page("free"), paid]);
    expect(rows.map((row) => row.storeAppId)).toEqual(["app-3", "app-2"]);
    expect(
      rows[0].places.map((place) => place.entry?.position ?? null),
    ).toEqual([3, 7]);
    expect(
      rows[1].places.map((place) => place.entry?.position ?? null),
    ).toEqual([2, null]);
  });

  it("reads an app below the listed rows and skips one in no chart", () => {
    const deep = [entry(47, 50, { storeAppId: "app-3" })];
    const rows = trackedRows([page("free", { entries: deep })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].places[0].entry?.position).toBe(47);
  });

  it("keeps the depth of a captured chart and null for an uncaptured one", () => {
    const uncaptured = page("paid", { capture: null, entries: [] });
    const [row] = trackedRows([page("free"), uncaptured]);
    expect(row.places.map((place) => place.depth)).toEqual([100, null]);
  });
});

describe("historyDates", () => {
  it("keeps the newest seven days up to the shown one, oldest first", () => {
    const dates = Array.from(
      { length: 10 },
      (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`,
    );
    expect(historyDates([...dates].reverse(), "2026-11-09")).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
    ]);
  });
});

describe("historyReady", () => {
  it("needs four captured days up to the shown one", () => {
    const dates = ["2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09"];
    expect(historyReady(dates, "2026-11-12")).toBe(true);
    expect(historyReady(dates, "2026-11-11")).toBe(false);
  });
});

describe("historyDates for a day outside the listed dates", () => {
  it("still counts the shown day", () => {
    expect(historyDates(["2026-11-12"], "2026-08-01")).toEqual(["2026-08-01"]);
  });
});

describe("chartHistory", () => {
  it("follows the shown top apps through earlier captures", () => {
    const shown = page("free");
    const earlier = page("free", {
      capture: { ...shown.capture!, date: "2026-11-11" },
      entries: [
        entry(3, 3, { storeAppId: "app-1" }),
        entry(1, 1, { storeAppId: "app-3" }),
      ],
    });
    const history = chartHistory([earlier, shown], shown);
    expect(history.series.map((series) => series.id)).toEqual([
      "app-1",
      "app-2",
      "app-3",
      "app-4",
    ]);
    expect(history.series.find((series) => series.own)?.id).toBe("app-3");
    expect(history.rows).toEqual([
      {
        date: "2026-11-11",
        "app-1": 3,
        "app-2": null,
        "app-3": 1,
        "app-4": null,
      },
      { date: "2026-11-12", "app-1": 1, "app-2": 2, "app-3": 3, "app-4": 4 },
    ]);
  });

  it("skips a day without a capture", () => {
    const shown = page("free");
    const history = chartHistory(
      [page("free", { capture: null, entries: [] }), shown],
      shown,
    );
    expect(history.rows).toHaveLength(1);
  });
});
