import { describe, expect, it } from "vitest";
import type {
  ChangeEventItem,
  RankingPoint,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { buildRankingChart } from "@/components/rankings/pivot";
import {
  changedFieldsLabel,
  changeSincePrevious,
  historyView,
  movementLine,
  listingChangeDays,
  rankingsHistoryHref,
} from "./position-history";

const THROUGH = "2026-10-20";

const keyword = (
  over: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: "kw-1",
  text: "focus timer",
  tags: [],
  note: null,
  country: "us",
  serpVolatility7d: null,
  source: "TITLE",
  active: true,
  latestPosition: 7,
  latestDepth: 200,
  latestCheckedOn: THROUGH,
  previousPosition: 5,
  positionDelta1d: 2,
  positionDelta7d: null,
  traffic: 55,
  difficulty: 4,
  volume: 5000,
  relevance: 90,
  opportunity: 82,
  bucket: "primary",
  scoredAt: THROUGH,
  scoreProvenance: null,
  ...over,
});

const point = (
  date: string,
  position: number | null,
  depth = 200,
): RankingPoint => ({ date, position, depth });

const chartOf = (points: RankingPoint[]) =>
  buildRankingChart(
    [
      {
        keywordId: "kw-1",
        text: "focus timer",
        store: "APP_STORE",
        country: "us",
        points,
      },
    ],
    THROUGH,
  );

const event = (over: Partial<ChangeEventItem>): ChangeEventItem => ({
  id: "chg",
  appId: "app-1",
  appName: "Focus Timer",
  isCompetitor: false,
  field: "title",
  before: "a",
  after: "b",
  capturedAt: "2026-10-18T06:00:00.000Z",
  ...over,
});

const HOME = { country: "us", homeCountry: "us" };

describe("historyView", () => {
  it("W-PH-01 no checked day is empty", () => {
    expect(historyView(chartOf([]), keyword())).toEqual({ kind: "empty" });
  });

  it("W-PH-02 fewer than four checks draw dots and say how many", () => {
    expect(historyView(chartOf([point("2026-10-19", 4)]), keyword())).toEqual({
      kind: "chart",
      line: false,
      notes: ["1 check so far, the line appears after 4"],
    });
    expect(
      historyView(
        chartOf([
          point("2026-10-16", 6),
          point("2026-10-18", 5),
          point("2026-10-19", 4),
        ]),
        keyword(),
      ),
    ).toEqual({
      kind: "chart",
      line: false,
      notes: ["3 checks so far, the line appears after 4"],
    });
  });

  it("W-PH-03 four checks draw the line without a note", () => {
    expect(
      historyView(
        chartOf([
          point("2026-10-16", 6),
          point("2026-10-17", 5),
          point("2026-10-18", 5),
          point("2026-10-19", 4),
        ]),
        keyword(),
      ),
    ).toEqual({ kind: "chart", line: true, notes: [] });
  });

  it("W-PH-04 a range never found names the deepest depth", () => {
    expect(
      historyView(
        chartOf([
          point("2026-10-16", null, 100),
          point("2026-10-17", null, 100),
          point("2026-10-18", null, 200),
          point("2026-10-19", null, 200),
        ]),
        keyword(),
      ),
    ).toEqual({
      kind: "chart",
      line: true,
      notes: ["Not in the top 200 in this range"],
    });
    expect(
      historyView(
        chartOf([
          point("2026-10-16", null, 100),
          point("2026-10-17", null, 100),
          point("2026-10-18", null, 100),
          point("2026-10-19", null, 100),
        ]),
        keyword(),
      ),
    ).toEqual({
      kind: "chart",
      line: true,
      notes: ["Not in the top 100 in this range"],
    });
  });

  it("W-PH-05 a paused keyword names its last check", () => {
    const checks = [
      point("2026-10-09", 6),
      point("2026-10-10", 5),
      point("2026-10-11", 5),
      point("2026-10-12", 4),
    ];
    expect(
      historyView(
        chartOf(checks),
        keyword({ active: false, latestCheckedOn: "2026-10-12" }),
      ),
    ).toEqual({
      kind: "chart",
      line: true,
      notes: ["Paused, last checked Oct 12"],
    });
    const { latestCheckedOn, ...undated } = keyword({ active: false });
    expect(latestCheckedOn).toBe(THROUGH);
    expect(historyView(chartOf(checks), undated)).toEqual({
      kind: "chart",
      line: true,
      notes: ["Paused"],
    });
  });

  it("W-PH-06 notes keep the order insufficient, not found, paused", () => {
    expect(
      historyView(
        chartOf([point("2026-10-12", null)]),
        keyword({ active: false, latestCheckedOn: "2026-10-12" }),
      ),
    ).toEqual({
      kind: "chart",
      line: false,
      notes: [
        "1 check so far, the line appears after 4",
        "Not in the top 200 in this range",
        "Paused, last checked Oct 12",
      ],
    });
  });
});

describe("listingChangeDays", () => {
  it("W-PH-07 keeps the primary app only", () => {
    expect(
      listingChangeDays(
        [event({ isCompetitor: true }), event({ field: "subtitle" })],
        HOME,
      ),
    ).toEqual(new Map([["2026-10-18", ["subtitle"]]]));
  });

  it("W-PH-08 a home keyword keeps home events and drops another market", () => {
    expect(
      listingChangeDays(
        [
          event({ field: "title" }),
          event({ field: "subtitle", country: "us" }),
          event({ field: "icon", country: "pl" }),
        ],
        HOME,
      ),
    ).toEqual(new Map([["2026-10-18", ["title", "subtitle"]]]));
  });

  it("W-PH-09 a market keyword keeps its market and drops home events", () => {
    expect(
      listingChangeDays(
        [
          event({ field: "title" }),
          event({ field: "subtitle", country: "us" }),
          event({ field: "icon", country: "pl" }),
        ],
        { country: "pl", homeCountry: "us" },
      ),
    ).toEqual(new Map([["2026-10-18", ["icon"]]]));
  });

  it("W-PH-10 groups by UTC day and keeps each field once in order", () => {
    expect(
      listingChangeDays(
        [
          event({ field: "description", capturedAt: "2026-10-18T23:59:00Z" }),
          event({ field: "title", capturedAt: "2026-10-18T01:00:00Z" }),
          event({ field: "description", capturedAt: "2026-10-18T02:00:00Z" }),
          event({ field: "icon", capturedAt: "2026-10-19T00:00:00Z" }),
        ],
        HOME,
      ),
    ).toEqual(
      new Map([
        ["2026-10-18", ["description", "title"]],
        ["2026-10-19", ["icon"]],
      ]),
    );
  });
});

describe("changeSincePrevious", () => {
  const chart = chartOf([
    point("2026-10-14", 9),
    point("2026-10-16", 6),
    point("2026-10-17", 8),
    point("2026-10-18", 8),
    point("2026-10-19", null),
    point("2026-10-20", 5),
  ]);
  const at = (day: string) => chart.rows.findIndex((row) => row.date === day);

  it("W-PH-11 compares with the previous checked day", () => {
    expect(changeSincePrevious(chart, at("2026-10-14"))).toBeNull();
    expect(changeSincePrevious(chart, at("2026-10-16"))).toEqual({
      day: "2026-10-14",
      places: 3,
    });
    expect(changeSincePrevious(chart, at("2026-10-17"))).toEqual({
      day: "2026-10-16",
      places: -2,
    });
    expect(changeSincePrevious(chart, at("2026-10-18"))).toEqual({
      day: "2026-10-17",
      places: 0,
    });
    expect(changeSincePrevious(chart, at("2026-10-19"))).toBeNull();
    expect(changeSincePrevious(chart, at("2026-10-20"))).toBeNull();
    expect(changeSincePrevious(chart, at("2026-10-15"))).toBeNull();
  });
});

describe("tooltip wording", () => {
  it("W-PH-13 names the movement since the previous check", () => {
    expect(movementLine(3, "2026-10-18")).toBe("Up 3 since Oct 18");
    expect(movementLine(-2, "2026-10-18")).toBe("Down 2 since Oct 18");
    expect(movementLine(0, "2026-10-18")).toBe("No change since Oct 18");
  });

  it("W-PH-14 names the changed fields in order", () => {
    expect(changedFieldsLabel(["title", "screenshotCaptions"])).toBe(
      "Title, Screenshot captions",
    );
  });
});

describe("rankingsHistoryHref", () => {
  it("W-PH-12 opens the rankings page on the keyword and range", () => {
    expect(rankingsHistoryHref("app-1", "kw-1", "7d")).toBe(
      "/apps/app-1/rankings?keywords=kw-1&range=7d",
    );
  });
});
