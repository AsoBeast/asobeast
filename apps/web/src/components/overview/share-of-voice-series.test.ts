import { describe, expect, it } from "vitest";
import { hasNonBranded, shareSeries } from "./share-of-voice-series";

describe("shareSeries", () => {
  it("merges both series by date and keeps a day only one of them has", () => {
    expect(
      shareSeries({
        points: [],
        shareOfVoice: [
          { date: "2026-11-02", share: 40, competitors: 1 },
          { date: "2026-11-03", share: 42, competitors: 2 },
        ],
        nonBrandedShareOfVoice: [
          { date: "2026-11-01", share: 50, competitors: 1 },
          { date: "2026-11-03", share: 51.3, competitors: 2 },
        ],
      }),
    ).toEqual([
      { date: "2026-11-01", nonBranded: 50, competitors: 1 },
      { date: "2026-11-02", share: 40, competitors: 1 },
      { date: "2026-11-03", share: 42, nonBranded: 51.3, competitors: 2 },
    ]);
  });

  it("leaves the non branded share out when the answer has none", () => {
    const history = {
      points: [],
      shareOfVoice: [{ date: "2026-11-03", share: 42, competitors: 1 }],
    };

    expect(shareSeries(history)).toEqual([
      { date: "2026-11-03", share: 42, competitors: 1 },
    ]);
    expect(hasNonBranded(history)).toBe(false);
  });

  it("charts nothing for an answer without share of voice", () => {
    expect(shareSeries({ points: [] })).toEqual([]);
  });
});
