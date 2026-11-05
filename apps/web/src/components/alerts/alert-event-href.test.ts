import {
  RANK_DEPTH,
  type AlertEventItem,
  type AlertFeedEvent,
  type ChartMoveScope,
  type GranularAlertPayload,
  type KeywordScope,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  breakdownParser,
  chartParsers,
  keywordFilterParsers,
  reviewScoreParser,
  serpParser,
} from "@/lib/search-params";
import { parseKeywordSearch } from "@/components/keywords/keyword-search";
import { alertEventHref } from "./alert-event-href";

const app = { id: "app-1", name: "Focus Timer" };
const occurredAt = "2026-11-03T03:00:00.000Z";
const habit: KeywordScope = {
  id: "kw-1",
  text: "habit tracker",
  store: "APP_STORE",
  country: "de",
};
const kw9: KeywordScope = { ...habit, id: "kw-9", country: "us" };
const chart: ChartMoveScope = {
  store: "APP_STORE",
  country: "us",
  collection: "free",
  genre: "6007",
  genreName: "Productivity",
  device: "iphone",
};

const rank = {
  occurredAt,
  app,
  keyword: habit,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
};

function itemOf(
  payload: GranularAlertPayload & { event: AlertFeedEvent },
  primaryAppId: string | null = "app-1",
): AlertEventItem {
  return {
    id: "evt",
    event: payload.event,
    occurredAt,
    sentence: "",
    appId: "app" in payload ? payload.app.id : null,
    appName: null,
    iconUrl: null,
    store: null,
    country: null,
    primaryAppId,
    payload,
  };
}

const chartBase = { occurredAt, app, chart, date: "2026-11-02", depth: 100 };

const rankRows = [
  itemOf({ ...rank, event: "rank.dropped", from: 3, to: 12, threshold: 5 }),
  itemOf({ ...rank, event: "rank.improved", from: 12, to: 3, threshold: 5 }),
  itemOf({
    ...rank,
    event: "rank.milestone",
    tier: 10,
    direction: "entered",
    from: 12,
    to: 8,
  }),
  itemOf({
    occurredAt,
    app,
    keyword: habit,
    event: "rank.first",
    position: 9,
    depth: RANK_DEPTH,
  }),
];

const chartRows = [
  itemOf({ ...chartBase, event: "chart.entered", from: null, to: 7 }),
  itemOf({ ...chartBase, event: "chart.left", from: 90, to: null }),
  itemOf({
    ...chartBase,
    event: "chart.milestone",
    tier: 10,
    direction: "entered",
    from: 12,
    to: 9,
  }),
];

const queryOf = (href: string | null) =>
  new URL(href ?? "/", "http://localhost").searchParams;

describe("alertEventHref", () => {
  it.each(rankRows.map((item) => [item.event, item] as const))(
    "opens the keywords table filtered to the keyword of a %s",
    (_event, item) => {
      const href = alertEventHref(item);

      expect(href).toBe(
        "/apps/app-1/keywords?country=de&q=%22habit+tracker%22",
      );
      expect(
        parseKeywordSearch(
          keywordFilterParsers.q.parse(queryOf(href).get("q") ?? "") ?? "",
        ),
      ).toEqual({ kind: "exact", phrase: "habit tracker" });
    },
  );

  it("searches a keyword holding a quote mark without wrapping it", () => {
    const item = itemOf({
      ...rank,
      keyword: { ...habit, text: 'say "hi"' },
      event: "rank.dropped",
      from: 3,
      to: 12,
      threshold: 5,
    });

    expect(alertEventHref(item)).toBe(
      "/apps/app-1/keywords?country=de&q=say+%22hi%22",
    );
  });

  it("opens the keyword breakdown of an overtake", () => {
    const href = alertEventHref(
      itemOf({
        ...rank,
        keyword: kw9,
        event: "rank.overtaken",
        competitor: { id: "comp-1", name: "Rival", from: 9, to: 4 },
        from: 5,
        to: 6,
      }),
    );

    expect(href).toBe("/apps/app-1/competitors?country=us&keyword=kw-9");
    expect(breakdownParser.parse(queryOf(href).get("keyword") ?? "")).toBe(
      "kw-9",
    );
  });

  it("opens the search results sheet of an entrant", () => {
    const href = alertEventHref(
      itemOf({
        event: "serp.entrant",
        occurredAt,
        keyword: kw9,
        date: "2026-11-03",
        entrants: [],
      }),
    );

    expect(href).toBe("/apps/app-1/keywords?country=us&serp=kw-9");
    expect(serpParser.parse(queryOf(href).get("serp") ?? "")).toBe("kw-9");
  });

  it("opens the changes of the primary app of a competitor", () => {
    const item = itemOf({
      event: "metadata.changed",
      occurredAt,
      app: { id: "comp-1", name: "Rival", isCompetitor: true },
      changes: [{ field: "title", before: "a", after: "b" }],
    });

    expect(item.appId).toBe("comp-1");
    expect(alertEventHref(item)).toBe("/apps/app-1/changes");
  });

  it("opens the reviews of the score of a negative review", () => {
    const href = alertEventHref(
      itemOf({
        event: "review.negative",
        occurredAt,
        app,
        review: {
          score: 1,
          title: null,
          text: "bad",
          version: null,
          reviewedAt: null,
        },
      }),
    );

    expect(href).toBe("/apps/app-1/reviews?score=1");
    expect(reviewScoreParser.parse(queryOf(href).get("score") ?? "")).toBe(1);
  });

  it("opens the action sheet of an opened action, with or without an app", () => {
    const item = itemOf(
      {
        event: "action.opened",
        occurredAt,
        app: { ...app, store: "APP_STORE", country: "us" },
        action: {
          id: "act-7",
          rule: "keyword.add_uncovered",
          category: "metadata",
          priority: "high",
          impact: 71,
          firstSeenAt: occurredAt,
          reopened: false,
        },
        keyword: { id: "kw-6", text: "deep work" },
        evidence: {
          rule: "keyword.add_uncovered",
          opportunity: 66.5,
          traffic: null,
          difficulty: null,
          volume: 62,
          relevance: 80,
          latestPosition: null,
          indexedFields: ["title"],
          uncoveredFields: ["title"],
          keywordFieldCharsFree: 18,
          scoreProvenance: null,
        },
        link: null,
      },
      null,
    );

    expect(alertEventHref(item)).toBe("/actions?action=act-7");
  });

  it.each(chartRows.map((item) => [item.event, item] as const))(
    "opens the chart table of the day of a %s",
    (_event, item) => {
      const href = alertEventHref(item);
      const query = queryOf(href);

      expect(href?.startsWith("/charts?")).toBe(true);
      expect(chartParsers.view.parse(query.get("view") ?? "")).toBe("table");
      expect(chartParsers.store.parse(query.get("store") ?? "")).toBe(
        "APP_STORE",
      );
      expect(chartParsers.country.parse(query.get("country") ?? "")).toBe("us");
      expect(chartParsers.collection.parse(query.get("collection") ?? "")).toBe(
        "free",
      );
      expect(chartParsers.genre.parse(query.get("genre") ?? "")).toBe("6007");
      expect(chartParsers.device.parse(query.get("device") ?? "")).toBe(
        "iphone",
      );
      expect(chartParsers.date.parse(query.get("date") ?? "")).toBe(
        "2026-11-02",
      );
    },
  );

  it.each([
    [
      "rating.dropped",
      itemOf({
        event: "rating.dropped",
        occurredAt,
        app,
        country: "us",
        from: 4.7,
        to: 4.5,
        fromCount: 10,
        toCount: 12,
        fromDate: "2026-10-27",
        toDate: "2026-11-03",
        dropTenths: 2,
        version: null,
        actionId: null,
      }),
      "/apps/app-1/reviews",
    ],
    [
      "review.spike",
      itemOf({
        event: "review.spike",
        occurredAt,
        app,
        date: "2026-11-02",
        count: 34,
        median: 4,
        threshold: 12,
        lowShare: 0.7,
        lowScoreMax: 2,
        topTheme: null,
      }),
      "/apps/app-1/reviews",
    ],
    [
      "app.delisted",
      itemOf({
        event: "app.delisted",
        occurredAt,
        app: { ...app, isCompetitor: false },
        store: "APP_STORE",
        country: "us",
        date: "2026-11-03",
      }),
      "/apps/app-1",
    ],
    [
      "app.unlisted_market",
      itemOf({
        event: "app.unlisted_market",
        occurredAt,
        app: { ...app, isCompetitor: false },
        store: "APP_STORE",
        country: "us",
        market: "de",
        date: "2026-11-03",
        trackedKeywords: 3,
      }),
      "/apps/app-1/keywords?country=de",
    ],
  ])("links a %s", (_event, item, href) => {
    expect(alertEventHref(item)).toBe(href);
  });

  it("links nothing for an app event without a primary app", () => {
    expect(alertEventHref({ ...rankRows[0], primaryAppId: null })).toBeNull();
    expect(
      alertEventHref(
        itemOf(
          {
            event: "serp.entrant",
            occurredAt,
            keyword: kw9,
            date: "2026-11-03",
            entrants: [],
          },
          null,
        ),
      ),
    ).toBeNull();
  });
});
