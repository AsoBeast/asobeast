import { describe, expect, it } from "vitest";
import type { ListingMarket } from "@asobeast/shared";
import {
  type MarketRatingRow,
  marketRatingRows,
  ratesByMarket,
  ratingTotal,
} from "./ratings-by-market";

const CAPTURED = "2026-10-26T12:00:00.000Z";

const market = (
  country: string,
  ratingAvg: number | null,
  ratingCount: number | null,
  home = false,
): ListingMarket => ({
  country,
  home,
  capturedAt: CAPTURED,
  ratingAvg,
  ratingCount,
});

const rated = (
  country: string,
  ratingAvg: number | null,
  ratingCount: number | null,
): MarketRatingRow => ({
  country,
  home: false,
  state: ratingAvg === null ? "unrated" : "rated",
  ratingAvg,
  ratingCount,
  capturedAt: CAPTURED,
});

const codes = (rows: readonly MarketRatingRow[]) =>
  rows.map((row) => row.country);

describe("ratesByMarket", () => {
  it("rates App Store apps by market", () => {
    expect(ratesByMarket("APP_STORE")).toBe(true);
  });

  it("leaves Google Play apps out", () => {
    expect(ratesByMarket("GOOGLE_PLAY")).toBe(false);
  });
});

describe("marketRatingRows", () => {
  it("puts the home market first and the others by rating count", () => {
    const rows = marketRatingRows([
      market("pl", 4.6, 3100),
      market("us", 4.8, 12, true),
      market("de", 4.4, 5200),
    ]);

    expect(codes(rows)).toEqual(["us", "de", "pl"]);
  });

  it("orders equal counts by country code", () => {
    const rows = marketRatingRows([
      market("pl", 4.6, 100),
      market("de", 4.4, 100),
    ]);

    expect(codes(rows)).toEqual(["de", "pl"]);
  });

  it("puts a market without a count after every market with one", () => {
    const rows = marketRatingRows([
      market("jp", null, null),
      market("ba", 4.1, 0),
      market("de", 4.4, 5200),
    ]);

    expect(codes(rows)).toEqual(["de", "ba", "jp"]);
  });

  it("reads absent rating fields as no rating", () => {
    const [row] = marketRatingRows([
      { country: "us", home: true, capturedAt: CAPTURED },
    ]);

    expect(row).toMatchObject({
      ratingAvg: null,
      ratingCount: null,
      state: "unrated",
    });
  });

  it("says a market without a capture is uncaptured whatever its rating", () => {
    const [row] = marketRatingRows([
      { ...market("us", 4.8, 24000, true), capturedAt: null },
    ]);

    expect(row.state).toBe("uncaptured");
  });

  it("says a captured market without an average is unrated", () => {
    const [row] = marketRatingRows([market("de", null, 5200)]);

    expect(row.state).toBe("unrated");
  });

  it("says a captured market with an average is rated", () => {
    const [row] = marketRatingRows([market("de", 4.4, 5200)]);

    expect(row.state).toBe("rated");
  });

  it("leaves its input untouched", () => {
    const input = [market("pl", 4.6, 3100), market("de", 4.4, 5200)];
    const copy = structuredClone(input);

    marketRatingRows(input);

    expect(input).toEqual(copy);
  });
});

describe("ratingTotal", () => {
  it("averages the markets weighted by their rating count", () => {
    const total = ratingTotal([
      rated("us", 4.8, 24000),
      rated("pl", 4.6, 3100),
    ]);

    expect(total?.average).toBeCloseTo(4.777, 3);
    expect(total?.count).toBe(27100);
    expect(total?.markets).toBe(2);
  });

  it("answers nothing for a single rated market", () => {
    expect(ratingTotal([rated("us", 4.8, 24000)])).toBeNull();
  });

  it("leaves a market with no ratings out of the weights", () => {
    expect(
      ratingTotal([rated("us", 4.8, 24000), rated("pl", 4.6, 0)]),
    ).toBeNull();
  });

  it("answers nothing without two rated markets", () => {
    expect(
      ratingTotal([
        rated("us", null, null),
        { ...rated("pl", null, null), state: "uncaptured", capturedAt: null },
      ]),
    ).toBeNull();
  });

  it("counts only the rated markets", () => {
    const total = ratingTotal([
      rated("us", 4.8, 24000),
      rated("de", 4.4, 5200),
      rated("pl", 4.6, 3100),
      rated("br", 3.9, 800),
      rated("ba", 4.1, 12),
      rated("jp", null, null),
    ]);

    expect(total?.markets).toBe(5);
    expect(total?.count).toBe(33112);
  });
});
