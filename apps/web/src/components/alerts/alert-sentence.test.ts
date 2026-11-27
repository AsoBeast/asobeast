import {
  ACTION_RULES,
  CHANGE_FIELDS,
  isAlertFeedEvent,
  RANK_DEPTH,
  SERP_DEPTH,
  type AlertEventItem,
  type GranularAlertPayload,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { alertSentence, CHANGE_FIELD_ZH, RULE_ZH } from "./alert-sentence";

const keyword = {
  id: "kw-1",
  text: "focus timer",
  store: "APP_STORE" as const,
  country: "us",
};

function item(
  payload: GranularAlertPayload,
  sentence = "English sentence",
): AlertEventItem {
  return {
    id: "event-1",
    event: isAlertFeedEvent(payload.event) ? payload.event : "rank.dropped",
    occurredAt: payload.occurredAt,
    sentence,
    appId: "app-1",
    appName: "Focus Timer",
    iconUrl: null,
    store: "APP_STORE",
    country: "us",
    primaryAppId: "app-1",
    payload,
  };
}

const OCCURRED = "2026-11-25T12:00:00.000Z";

describe("alertSentence rank events", () => {
  it("keeps the stored sentence for English", () => {
    const event = item(
      {
        event: "rank.dropped",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        keyword,
        from: 4,
        to: 12,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
        threshold: 5,
      },
      "Focus Timer fell from #4 to #12",
    );
    expect(alertSentence(event, "en")).toBe("Focus Timer fell from #4 to #12");
  });

  it("translates a rank drop with its keyword and market", () => {
    const text = alertSentence(
      item(
        {
          event: "rank.dropped",
          occurredAt: OCCURRED,
          app: { id: "app-1", name: "Focus Timer" },
          keyword,
          from: 4,
          to: 12,
          fromDepth: RANK_DEPTH,
          toDepth: RANK_DEPTH,
          threshold: 5,
        },
        'Focus Timer fell from #4 to #12 for "focus timer" in US',
      ),
      "zh-CN",
    );
    expect(text).toContain("Focus Timer");
    expect(text).toContain("美国的关键词“focus timer”");
    expect(text).toContain("从第 4 名降至第 12 名");
    expect(text).not.toContain("fell from");
  });

  it("describes an unranked move without inventing a position", () => {
    const text = alertSentence(
      item({
        event: "rank.improved",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: null },
        keyword,
        from: null,
        to: 7,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
        threshold: 5,
      }),
      "zh-CN",
    );
    expect(text).toContain(`前 ${RANK_DEPTH} 名之外`);
    expect(text).toContain("第 7 名");
  });

  it("translates milestone, first ranking and overtake sentences", () => {
    const milestone = alertSentence(
      item({
        event: "rank.milestone",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        keyword,
        tier: 10,
        direction: "entered",
        from: 14,
        to: 8,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
      }),
      "zh-CN",
    );
    expect(milestone).toContain("进入前 10 名");
    expect(milestone).toContain("第 14 名 → 第 8 名");

    const first = alertSentence(
      item({
        event: "rank.first",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        keyword,
        position: 37,
        depth: RANK_DEPTH,
      }),
      "zh-CN",
    );
    expect(first).toContain("首次");
    expect(first).toContain("第 37 名");

    const overtake = alertSentence(
      item({
        event: "rank.overtaken",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        keyword,
        competitor: { id: "app-2", name: "Rival Focus", from: 6, to: 4 },
        from: 4,
        to: 6,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
      }),
      "zh-CN",
    );
    expect(overtake).toContain("Rival Focus");
    expect(overtake).toContain("超越了Focus Timer");
  });
});

describe("alertSentence review events", () => {
  it("translates metadata fields and keeps the competitor marker", () => {
    const text = alertSentence(
      item({
        event: "metadata.changed",
        occurredAt: OCCURRED,
        app: { id: "app-2", name: "Rival Focus", isCompetitor: true },
        changes: [
          { field: "title", before: "A", after: "B" },
          { field: "subtitle", before: "C", after: "D" },
          { field: "subtitle", before: "D", after: "E" },
        ],
      }),
      "zh-CN",
    );
    expect(text).toContain("Rival Focus（竞品）");
    expect(text).toContain("标题、副标题");
    expect(text).not.toContain("副标题、副标题");
  });

  it("keeps review text and version while translating the wrapper", () => {
    const text = alertSentence(
      item({
        event: "review.negative",
        occurredAt: OCCURRED,
        app: { id: "app-3", name: null },
        review: {
          score: 1,
          title: null,
          text: "التطبيق يتوقف عند الفتح",
          version: "2.1.0",
          reviewedAt: null,
        },
      }),
      "zh-CN",
    );
    expect(text).toContain("一个应用");
    expect(text).toContain("1 星评论");
    expect(text).toContain("التطبيق يتوقف عند الفتح");
    expect(text).toContain("v2.1.0");
  });
});

describe("alertSentence listing events", () => {
  it("translates rating, spike, availability and entrant sentences", () => {
    const rating = alertSentence(
      item({
        event: "rating.dropped",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        country: "us",
        from: 4.66,
        to: 4.44,
        fromCount: 100,
        toCount: 120,
        fromDate: "2026-11-18",
        toDate: "2026-11-25",
        dropTenths: 2,
        version: "v1.4.0",
        actionId: null,
      }),
      "zh-CN",
    );
    expect(rating).toContain("在美国");
    expect(rating).toContain("7 天内从 4.66 降至 4.44");
    expect(rating).toContain("自 v1.4.0 发布以来");

    const spike = alertSentence(
      item({
        event: "review.spike",
        occurredAt: OCCURRED,
        app: { id: "app-3", name: "Tomato Clock" },
        date: "2026-11-24",
        count: 34,
        median: 8,
        threshold: 20,
        lowShare: 0.5,
        lowScoreMax: 1,
        topTheme: null,
      }),
      "zh-CN",
    );
    expect(spike).toContain("2026年11月24日");
    expect(spike).toContain("34 条评论");
    expect(spike).toContain("50% 为 1 星及以下");

    const delisted = alertSentence(
      item({
        event: "app.delisted",
        occurredAt: OCCURRED,
        app: { id: "app-2", name: "Rival Focus", isCompetitor: true },
        store: "APP_STORE",
        country: "us",
        date: "2026-11-24",
      }),
      "zh-CN",
    );
    expect(delisted).toContain("Rival Focus（竞品）已从App Store下架（美国）");

    const unlisted = alertSentence(
      item({
        event: "app.unlisted_market",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer", isCompetitor: false },
        store: "APP_STORE",
        country: "us",
        market: "de",
        date: "2026-11-24",
        trackedKeywords: 12,
      }),
      "zh-CN",
    );
    expect(unlisted).toContain("跟踪了 12 个关键词");
    expect(unlisted).toContain("德国市场");

    const entrant = alertSentence(
      item({
        event: "serp.entrant",
        occurredAt: OCCURRED,
        keyword,
        date: "2026-11-24",
        entrants: [
          {
            position: 6,
            storeAppId: "store-1",
            title: "Calm Clock",
            appId: null,
            isCompetitor: false,
          },
        ],
      }),
      "zh-CN",
    );
    expect(entrant).toContain(`新入围前 ${SERP_DEPTH} 名：#6 Calm Clock`);
  });
});

describe("alertSentence actions and charts", () => {
  it("translates actions and chart moves", () => {
    const action = alertSentence(
      item({
        event: "action.opened",
        occurredAt: OCCURRED,
        app: {
          id: "app-1",
          name: "Focus Timer",
          store: "APP_STORE",
          country: "us",
        },
        action: {
          id: "act-1",
          rule: "keyword.add_uncovered",
          category: "metadata",
          priority: "high",
          impact: 70,
          firstSeenAt: OCCURRED,
          reopened: false,
        },
        keyword: { id: "kw-1", text: "habit tracker" },
        evidence: {
          rule: "keyword.add_uncovered",
          opportunity: 80,
          traffic: null,
          difficulty: null,
          volume: null,
          relevance: null,
          latestPosition: null,
          indexedFields: [],
          uncoveredFields: ["title"],
          keywordFieldCharsFree: null,
          scoreProvenance: null,
        },
        link: null,
      }),
      "zh-CN",
    );
    expect(action).toContain("高优先级行动");
    expect(action).toContain(RULE_ZH["keyword.add_uncovered"]);
    expect(action).toContain("影响 70");

    const entered = alertSentence(
      item({
        event: "chart.entered",
        occurredAt: OCCURRED,
        app: { id: "app-3", name: "Tomato Clock" },
        chart: {
          store: "GOOGLE_PLAY",
          country: "de",
          collection: "free",
          genre: "PRODUCTIVITY",
          genreName: "Productivity",
          device: "iphone",
        },
        date: "2026-11-24",
        depth: 100,
        from: null,
        to: 48,
      }),
      "zh-CN",
    );
    expect(entered).toContain("免费榜 · Productivity（德国）");
    expect(entered).toContain("第 48 名");

    const milestone = alertSentence(
      item({
        event: "chart.milestone",
        occurredAt: OCCURRED,
        app: { id: "app-1", name: "Focus Timer" },
        chart: {
          store: "APP_STORE",
          country: "us",
          collection: "free",
          genre: "PRODUCTIVITY",
          genreName: "Productivity",
          device: "iphone",
        },
        date: "2026-11-24",
        depth: 100,
        tier: 10,
        direction: "entered",
        from: 13,
        to: 9,
      }),
      "zh-CN",
    );
    expect(milestone).toContain("进入前 10 名");
  });

  it("covers every rule and change field with a Chinese label", () => {
    expect(ACTION_RULES.every((rule) => RULE_ZH[rule].length > 0)).toBe(true);
    expect(
      CHANGE_FIELDS.every((field) => CHANGE_FIELD_ZH[field].length > 0),
    ).toBe(true);
  });
});
