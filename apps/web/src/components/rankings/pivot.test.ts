import { describe, expect, it } from "vitest";
import type { RankingSeriesItem } from "@asobeast/shared";
import {
  buildRankingChart,
  hasCheck,
  lastCheckedIndex,
  loneKey,
} from "./pivot";
import { rankingCsv } from "./ranking-csv";

const series = (over: Partial<RankingSeriesItem>): RankingSeriesItem => ({
  keywordId: "kw-1",
  text: "habit tracker",
  store: "APP_STORE",
  country: "us",
  points: [{ date: "2026-08-20", position: 4, depth: 200 }],
  ...over,
});

const THROUGH = "2026-08-20";

const point = (date: string, position: number | null, depth = 200) => ({
  date,
  position,
  depth,
});

describe("buildRankingChart", () => {
  it("names the market a keyword was checked in", () => {
    const chart = buildRankingChart([series({})], THROUGH);

    expect(chart.seriesLabels["kw-1"]).toBe("habit tracker (US)");
  });

  it("keeps one phrase in two markets apart", () => {
    const chart = buildRankingChart(
      [series({}), series({ keywordId: "kw-2", country: "de" })],
      THROUGH,
    );

    expect(chart.seriesLabels["kw-1"]).not.toBe(chart.seriesLabels["kw-2"]);
    expect(chart.seriesLabels["kw-2"]).toBe("habit tracker (DE)");
  });
});

describe("rankingCsv", () => {
  it("heads each column with the market its keyword belongs to", () => {
    const csv = rankingCsv(
      buildRankingChart(
        [series({}), series({ keywordId: "kw-2", country: "de" })],
        THROUGH,
      ),
    );
    const [header] = csv.split("\r\n");

    expect(header).toContain("habit tracker (US)");
    expect(header).toContain("habit tracker (DE)");
  });

  it("writes only days that have a check", () => {
    const csv = rankingCsv(
      buildRankingChart(
        [series({ points: [point("2026-08-18", 4), point("2026-08-20", 5)] })],
        "2026-08-20",
      ),
    );

    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).not.toContain("2026-08-19");
  });
});

describe("a keyword that did not exist on an earlier date", () => {
  const withGap = [
    series({ points: [{ date: "2026-08-21", position: 4, depth: 200 }] }),
    series({
      keywordId: "kw-2",
      text: "streak counter",
      points: [
        { date: "2026-08-20", position: 9, depth: 200 },
        { date: "2026-08-21", position: 7, depth: 200 },
      ],
    }),
  ];

  it("carries no depth for the day it was not checked", () => {
    const chart = buildRankingChart(withGap, THROUGH);

    expect(chart.depths[0]["kw-1"]).toBeNull();
    expect(chart.depths[1]["kw-1"]).toBe(200);
  });

  it("leaves its csv cell empty rather than claiming it ranked beyond depth", () => {
    const csv = rankingCsv(buildRankingChart(withGap, THROUGH));
    const [, firstRow] = csv.split("\r\n");

    expect(firstRow).toBe("2026-08-20,,9");
  });
});

describe("the chart axis", () => {
  it("puts a day without any check on the axis with no values", () => {
    const chart = buildRankingChart(
      [series({ points: [point("2026-08-18", 4), point("2026-08-20", 5)] })],
      "2026-08-20",
    );

    expect(chart.rows.map((row) => row.date)).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
    expect(chart.rows[1]?.["kw-1"]).toBeNull();
    expect(chart.depths[1]?.["kw-1"]).toBeNull();
    expect(chart.checkedDays).toBe(2);
  });

  it("runs the axis to yesterday when the checks stopped earlier", () => {
    const chart = buildRankingChart(
      [series({ points: [point("2026-08-15", 4)] })],
      "2026-08-20",
    );

    expect(chart.rows.at(-1)?.date).toBe("2026-08-19");
    expect(chart.rows).toHaveLength(5);
    expect(chart.checkedDays).toBe(1);
  });

  it("leaves today off the axis until today has a check", () => {
    const before = buildRankingChart(
      [series({ points: [point("2026-08-19", 4)] })],
      "2026-08-20",
    );
    const after = buildRankingChart(
      [series({ points: [point("2026-08-19", 4), point("2026-08-20", 3)] })],
      "2026-08-20",
    );

    expect(before.rows.at(-1)?.date).toBe("2026-08-19");
    expect(after.rows.at(-1)?.date).toBe("2026-08-20");
  });

  it("starts at the first checked day, not at the range start", () => {
    const chart = buildRankingChart(
      [series({ points: [point("2026-08-19", 4)] })],
      "2026-08-20",
    );

    expect(chart.rows[0]?.date).toBe("2026-08-19");
  });

  it("draws nothing for a range with no checks", () => {
    const chart = buildRankingChart([series({ points: [] })], "2026-08-20");

    expect(chart.rows).toEqual([]);
    expect(chart.checkedDays).toBe(0);
  });

  it("crosses a month boundary", () => {
    const chart = buildRankingChart(
      [series({ points: [point("2026-08-30", 4), point("2026-09-02", 4)] })],
      "2026-09-02",
    );

    expect(chart.rows.map((row) => row.date)).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("lone points", () => {
  it("marks a ranked day with no position on either side", () => {
    const chart = buildRankingChart(
      [
        series({
          points: [
            point("2026-08-16", 4),
            point("2026-08-18", 6),
            point("2026-08-19", 7),
            point("2026-08-20", null),
          ],
        }),
      ],
      "2026-08-20",
    );

    expect(chart.rows[0]?.[loneKey("kw-1")]).toBe(4);
    expect(chart.rows[2]?.[loneKey("kw-1")]).toBeNull();
    expect(chart.rows[3]?.[loneKey("kw-1")]).toBeNull();
  });

  it("marks a ranked day between two not found days", () => {
    const chart = buildRankingChart(
      [
        series({
          points: [
            point("2026-08-18", null),
            point("2026-08-19", 9),
            point("2026-08-20", null),
          ],
        }),
      ],
      "2026-08-20",
    );

    expect(chart.rows[1]?.[loneKey("kw-1")]).toBe(9);
  });
});

describe("checked days", () => {
  it("finds the last day that has a check", () => {
    const chart = buildRankingChart(
      [series({ points: [point("2026-08-15", 4)] })],
      "2026-08-20",
    );

    expect(lastCheckedIndex(chart)).toBe(0);
    expect(hasCheck(chart.depths[0])).toBe(true);
    expect(hasCheck(chart.depths[1])).toBe(false);
    expect(hasCheck(undefined)).toBe(false);
  });
});
