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
