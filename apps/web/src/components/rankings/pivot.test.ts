import { describe, expect, it } from "vitest";
import type { RankingSeriesItem } from "@asobeast/shared";
import { buildRankingChart } from "./pivot";
import { rankingCsv } from "./ranking-csv";

const series = (over: Partial<RankingSeriesItem>): RankingSeriesItem => ({
  keywordId: "kw-1",
  text: "habit tracker",
  store: "APP_STORE",
  country: "us",
  points: [{ date: "2026-08-20", position: 4, depth: 200 }],
  ...over,
});

describe("buildRankingChart", () => {
  it("names the market a keyword was checked in", () => {
    const chart = buildRankingChart([series({})]);

    expect(chart.seriesLabels["kw-1"]).toBe("habit tracker (US)");
  });

  it("keeps one phrase in two markets apart", () => {
    const chart = buildRankingChart([
      series({}),
      series({ keywordId: "kw-2", country: "de" }),
    ]);

    expect(chart.seriesLabels["kw-1"]).not.toBe(chart.seriesLabels["kw-2"]);
    expect(chart.seriesLabels["kw-2"]).toBe("habit tracker (DE)");
  });
});

describe("rankingCsv", () => {
  it("heads each column with the market its keyword belongs to", () => {
    const csv = rankingCsv(
      buildRankingChart([
        series({}),
        series({ keywordId: "kw-2", country: "de" }),
      ]),
    );
    const [header] = csv.split("\r\n");

    expect(header).toContain("habit tracker (US)");
    expect(header).toContain("habit tracker (DE)");
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
    const chart = buildRankingChart(withGap);

    expect(chart.depths[0]["kw-1"]).toBeNull();
    expect(chart.depths[1]["kw-1"]).toBe(200);
  });

  it("leaves its csv cell empty rather than claiming it ranked beyond depth", () => {
    const csv = rankingCsv(buildRankingChart(withGap));
    const [, firstRow] = csv.split("\r\n");

    expect(firstRow).toBe("2026-08-20,,9");
  });
});
