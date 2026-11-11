import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { InsightsCell } from "./InsightsCell";

const TODAY = "2026-11-06";

const POMODORO: TrackedKeywordItem = {
  keywordId: "kw-1",
  text: "pomodoro",
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: 12,
  latestDepth: 200,
  latestCheckedOn: TODAY,
  previousPosition: 9,
  positionDelta1d: -3,
  positionDelta7d: null,
  dropStreak: 3,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
};

const labelsOf = (markup: string): string[] =>
  [...markup.matchAll(/aria-label="([^"]*)"/g)].map(([, label]) => label);

describe("InsightsCell", () => {
  it("names each reason once, in the popover the badges open", () => {
    const labels = labelsOf(
      renderToStaticMarkup(
        <InsightsCell keyword={POMODORO} today={TODAY} multiMarket={false} />,
      ),
    );

    expect(labels).toEqual([
      "Insights",
      "Dropping, Page 1 close: reasons for pomodoro",
    ]);
    expect(labels.join(" ")).not.toContain("Fell on 3 checks in a row");
  });

  it("renders nothing for a keyword without an insight", () => {
    expect(
      renderToStaticMarkup(
        <InsightsCell
          keyword={{ ...POMODORO, dropStreak: 0, latestPosition: 40 }}
          today={TODAY}
          multiMarket={false}
        />,
      ),
    ).toBe("");
  });
});
