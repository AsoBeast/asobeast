import { describe, expect, it } from "vitest";
import { hasNonBranded, shareAxis, shareSeries } from "./share-of-voice-series";

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

describe("hasNonBranded", () => {
  it("draws the non branded line only when it differs from the total", () => {
    const point = { date: "2026-11-03", share: 15.5, competitors: 4 };

    expect(
      hasNonBranded({
        points: [],
        shareOfVoice: [point],
        nonBrandedShareOfVoice: [point],
      }),
    ).toBe(false);
    expect(
      hasNonBranded({
        points: [],
        shareOfVoice: [point],
        nonBrandedShareOfVoice: [{ ...point, share: 11.2 }],
      }),
    ).toBe(true);
  });
});

describe("shareAxis", () => {
  const rows = (...shares: number[]) =>
    shares.map((share, index) => ({
      date: `2026-11-0${index + 1}`,
      share,
      competitors: 4,
    }));

  it("scales a small share to the data and keeps zero at the bottom", () => {
    expect(shareAxis(rows(11, 15.5))).toEqual({
      domain: [0, 20],
      ticks: [0, 5, 10, 15, 20],
    });
  });

  it("counts the non branded share when it is the larger one", () => {
    expect(
      shareAxis([
        { date: "2026-11-01", share: 30, nonBranded: 44, competitors: 2 },
      ]),
    ).toEqual({ domain: [0, 60], ticks: [0, 20, 40, 60] });
  });

  it("never goes past 100%", () => {
    expect(shareAxis(rows(92))).toEqual({
      domain: [0, 100],
      ticks: [0, 25, 50, 75, 100],
    });
  });

  it("still draws an axis when every share is zero", () => {
    expect(shareAxis(rows(0, 0))).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});
