import type {
  StoreFunnelPoint,
  StoreFunnelReport,
  StoreFunnelWindow,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import {
  formatConversion,
  formatCount,
  funnelCopy,
  funnelGetsLabel,
  funnelState,
  funnelTrend,
  funnelTiles,
  noSearchTermsFact,
  refusalBody,
  searchShare,
  trendValue,
  windowOf,
} from "./funnel";

const en = translationContext("en", "overview");
const zh = translationContext("zh-CN", "overview");

const counts = (impressions: number | null, gets: number) => ({
  impressions,
  uniqueImpressions: impressions,
  pageViews: 10,
  gets,
  conversion: impressions ? gets / impressions : null,
});

const window = (
  days: 7 | 14 | 28,
  status: StoreFunnelWindow["status"],
): StoreFunnelWindow => ({
  days,
  status,
  from: "2026-09-16",
  to: "2026-10-13",
  current: status === "unmeasured" ? null : counts(1000, 30),
  previous: status === "measured" ? counts(800, 25) : null,
  change:
    status === "measured"
      ? { impressions: 0.25, pageViews: 0, gets: 0.18, conversion: -0.04 }
      : null,
});

const point = (
  date: string,
  total: number,
  search: number,
): StoreFunnelPoint => ({
  date,
  complete: true,
  total: counts(total, 1),
  search: counts(search, 1),
});

const REPORT: StoreFunnelReport = {
  appId: "app-1",
  store: "APP_STORE",
  country: null,
  connected: true,
  source: "appStoreConnect",
  days: 90,
  completeThrough: "2026-10-13",
  points: [
    point("2026-09-15", 1000, 1000),
    point("2026-09-16", 100, 60),
    point("2026-10-13", 100, 64),
    point("2026-10-14", 500, 0),
  ],
  windows: [
    window(7, "measured"),
    window(14, "measured"),
    window(28, "measured"),
  ],
};

describe("funnel helpers", () => {
  it("picks a window by its days", () => {
    expect(windowOf(REPORT, 28)?.days).toBe(28);
    expect(windowOf({ ...REPORT, windows: [] }, 28)).toBeNull();
  });

  it("formats counts and conversion", () => {
    expect(formatCount(12_345)).toBe("12,345");
    expect(formatCount(null)).toBe("—");
    expect(formatConversion(0.0312)).toBe("3.1%");
    expect(formatConversion(null)).toBe("—");
  });

  it("reads the search share of impressions inside a window", () => {
    expect(searchShare(REPORT, windowOf(REPORT, 28))).toBe(62);
    expect(searchShare(REPORT, null)).toBeNull();
    expect(
      searchShare({ ...REPORT, points: [] }, windowOf(REPORT, 28)),
    ).toBeNull();
  });

  it("turns a measured change into a percentage for a trend chip", () => {
    expect(trendValue(windowOf(REPORT, 7), "gets")).toBe(18);
    expect(trendValue(windowOf(REPORT, 7), "conversion")).toBe(-4);
    expect(trendValue(window(7, "pending"), "gets")).toBeNull();
    expect(trendValue(null, "gets")).toBeNull();
  });

  it("tells off, waiting and ready apart", () => {
    expect(funnelState({ ...REPORT, connected: false })).toBe("off");
    expect(
      funnelState({
        ...REPORT,
        windows: [
          window(7, "unmeasured"),
          window(14, "unmeasured"),
          window(28, "unmeasured"),
        ],
      }),
    ).toBe("waiting");
    expect(funnelState(REPORT)).toBe("ready");
  });
});

describe("funnelTrend", () => {
  it("lists a metric over the newest complete days", () => {
    expect(funnelTrend(REPORT, "impressions", 3)).toEqual([100, 100, 500]);
    expect(funnelTrend(REPORT, "gets", 28)).toEqual([1, 1, 1, 1]);
  });

  it("leaves out a day still filling in and draws nothing over a missing day", () => {
    const report = {
      ...REPORT,
      points: [
        point("2026-10-12", 0, 0),
        point("2026-10-13", 200, 100),
        { ...point("2026-10-14", 900, 0), complete: false },
      ],
    };

    expect(funnelTrend(report, "impressions", 28)).toEqual([0, 200]);
    expect(funnelTrend(report, "conversion", 28)).toEqual([]);
    expect(funnelTrend(report, "conversion", 1)).toEqual([1 / 200]);
  });
});

describe("noSearchTermsFact", () => {
  it("states the report fact with the console and the month it names", () => {
    expect(noSearchTermsFact("2026-09-01", en)).toBe(
      "Google Play Console's September 2026 report named no search terms for this app.",
    );
    expect(noSearchTermsFact("2026-09-01", zh)).toBe(
      "Google Play Console 的 2026年9月报告未列出此应用的搜索词。",
    );
  });

  it("stays silent without a month, as when nothing was imported", () => {
    expect(noSearchTermsFact(null)).toBeNull();
    expect(noSearchTermsFact(undefined)).toBeNull();
    expect(noSearchTermsFact("")).toBeNull();
  });
});

describe("refused connection copy", () => {
  it("names the key of an app store connection", () => {
    expect(funnelCopy("APP_STORE", en.translator).refusedTitle).toBe(
      "App Store Connect refused the connected key.",
    );
    expect(funnelCopy("APP_STORE", zh.translator).refusedTitle).toBe(
      "App Store Connect 拒绝了已连接的密钥。",
    );
  });

  it("never assumes a google play connection holds a key", () => {
    const copy = funnelCopy("GOOGLE_PLAY", en.translator);
    const lines = [
      copy.refusedTitle,
      copy.refusedBody,
      copy.refusedAskOwner,
      copy.notReporting,
    ];

    expect(copy.refusedTitle).toBe(
      "Google Play Console refused the connection.",
    );
    for (const line of lines) {
      expect(line).not.toMatch(/\bkey\b|service account/i);
    }
  });
});

describe("refusalBody", () => {
  const AGREEMENT =
    "Apple asks the account holder to accept the latest agreement in App Store Connect, under Business. Accept it, then verify the key again.";

  it("tells the owner the reason the store gave", () => {
    expect(refusalBody("APP_STORE", AGREEMENT, true, en.translator)).toBe(
      AGREEMENT,
    );
  });

  it("tells a member the reason and who can act on it", () => {
    expect(refusalBody("APP_STORE", AGREEMENT, false, en.translator)).toBe(
      `${AGREEMENT} Ask the workspace owner to verify the key in Integrations.`,
    );
    expect(refusalBody("APP_STORE", AGREEMENT, false, zh.translator)).toBe(
      `${AGREEMENT} 请工作区所有者在“集成”中验证该密钥。`,
    );
  });

  it("falls back to the general copy when no reason was kept", () => {
    expect(refusalBody("GOOGLE_PLAY", null, true, en.translator)).toBe(
      funnelCopy("GOOGLE_PLAY", en.translator).refusedBody,
    );
    expect(refusalBody("GOOGLE_PLAY", null, false, en.translator)).toBe(
      funnelCopy("GOOGLE_PLAY", en.translator).refusedAskOwner,
    );
    expect(refusalBody("GOOGLE_PLAY", null, false, zh.translator)).toBe(
      "请工作区所有者在“集成”中验证 Google Play 连接。",
    );
  });
});

describe("google play funnel", () => {
  const visitors = (total: number, search: number): StoreFunnelPoint => ({
    date: "2026-10-01",
    complete: true,
    total: {
      impressions: null,
      uniqueImpressions: null,
      pageViews: total,
      gets: 5,
      conversion: 0.05,
    },
    search: {
      impressions: null,
      uniqueImpressions: null,
      pageViews: search,
      gets: 3,
      conversion: 0.06,
    },
  });
  const PLAY: StoreFunnelReport = {
    ...REPORT,
    store: "GOOGLE_PLAY",
    source: "playConsole",
    points: [visitors(200, 150)],
  };

  it("shows visitors, acquisitions and conversion, and no impressions", () => {
    expect(funnelTiles(PLAY, en.translator).map((tile) => tile.label)).toEqual([
      "Store listing visitors",
      "Acquisitions",
      "Conversion",
    ]);
    expect(funnelTiles(PLAY, zh.translator).map((tile) => tile.label)).toEqual([
      "应用详情页访客",
      "获取量",
      "转化率",
    ]);
    expect(funnelGetsLabel("APP_STORE", zh.translator)).toBe("获取点击量");
    expect(funnelTiles(REPORT)).toHaveLength(4);
  });

  it("reads the search share of visitors for all markets only", () => {
    expect(searchShare(PLAY, windowOf(PLAY, 28))).toBe(75);
    expect(
      searchShare({ ...PLAY, country: "de" }, windowOf(PLAY, 28)),
    ).toBeNull();
  });

  it("names google's lag and the counting change", () => {
    expect(funnelCopy("GOOGLE_PLAY", en.translator).freshness).toBe(
      "Google posts a day three to seven days later; counting changed on July 10, 2026.",
    );
    expect(funnelCopy("GOOGLE_PLAY", zh.translator).freshness).toBe(
      "Google 会在三到七天后公布前一天的数据；统计方式于 2026年7月10日发生变化。",
    );
  });
});
