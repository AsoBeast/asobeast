import { describe, expect, it } from "vitest";
import type { RankingSeriesItem } from "@asobeast/shared";
import { buildRankingChart } from "./pivot";
import { rankingImageSpec, type ImageApp } from "./ranking-image";

const APP: ImageApp = {
  id: "app-1",
  name: "Focus Timer",
  storeAppId: "123456789",
  store: "APP_STORE",
};

const series = (keywordId: string, text: string): RankingSeriesItem => ({
  keywordId,
  text,
  store: "APP_STORE",
  country: "us",
  points: [4, 3, 2, 1].map((position, index) => ({
    date: `2026-10-${String(25 + index)}`,
    position,
    depth: 200,
  })),
});

const chart = buildRankingChart(
  [series("kw-1", "focus timer"), series("kw-2", "pomodoro")],
  "2026-10-28",
);

describe("rankingImageSpec", () => {
  it("names the file and draws the caption from the plotted days", () => {
    const spec = rankingImageSpec({
      chart,
      kind: "rankings",
      title: "Keyword rank positions",
      app: APP,
      countries: ["us"],
    });

    expect(spec?.filename).toBe(
      "asobeast-rankings-focus-timer-2026-10-25-2026-10-28.png",
    );
    expect(spec?.caption.title).toBe("Keyword rank positions");
    expect(spec?.caption.subtitle).toBe(
      "Focus Timer · App Store · United States · Oct 25, 2026 to Oct 28, 2026 UTC",
    );
  });

  it("lists every drawn keyword with its colour variable and stroke pattern", () => {
    const spec = rankingImageSpec({
      chart,
      kind: "rankings",
      title: "Keyword rank positions",
      app: APP,
      countries: ["us"],
    });

    expect(spec?.caption.series).toEqual([
      {
        label: "focus timer (US)",
        color: "var(--color-kw-1)",
        dash: undefined,
      },
      { label: "pomodoro (US)", color: "var(--color-kw-2)", dash: "6 3" },
    ]);
  });

  it("adds the keyword to the name of a position history", () => {
    const spec = rankingImageSpec({
      chart,
      kind: "position-history",
      title: "Position history: focus timer",
      app: APP,
      countries: ["us"],
      keyword: "focus timer",
    });

    expect(spec?.filename).toBe(
      "asobeast-position-history-focus-timer-focus-timer-2026-10-25-2026-10-28.png",
    );
  });

  it("answers nothing for a chart without days", () => {
    expect(
      rankingImageSpec({
        chart: buildRankingChart([], "2026-10-28"),
        kind: "rankings",
        title: "Keyword rank positions",
        app: APP,
        countries: [],
      }),
    ).toBeNull();
  });
});
