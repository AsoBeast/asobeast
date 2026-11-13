import { describe, expect, it } from "vitest";
import type { CompetitorMetadataRow, PositionMapPoint } from "@asobeast/shared";
import { barShare, hasRival, listingLines, standingRows } from "./standing";

const point = (overrides: Partial<PositionMapPoint>): PositionMapPoint => ({
  appId: "app",
  name: "App",
  isYou: false,
  visibility: 0,
  ratingAvg: null,
  ...overrides,
});

const listing: CompetitorMetadataRow = {
  appId: "app",
  name: "App",
  isYou: true,
  title: "Focus Timer",
  titleChars: 11,
  subtitle: null,
  subtitleChars: 0,
};

describe("standingRows", () => {
  it("orders by visibility, the own app first on a tie, without mutating", () => {
    const points = [
      point({ appId: "a", visibility: 10 }),
      point({ appId: "b", visibility: 40 }),
      point({ appId: "you", visibility: 40, isYou: true }),
    ];
    expect(standingRows(points).map((row) => row.appId)).toEqual([
      "you",
      "b",
      "a",
    ]);
    expect(points[0].appId).toBe("a");
  });
});

describe("hasRival", () => {
  it("is false for the own app alone and for nothing", () => {
    expect(hasRival([])).toBe(false);
    expect(hasRival([point({ isYou: true })])).toBe(false);
    expect(hasRival([point({ isYou: true }), point({})])).toBe(true);
  });
});

describe("barShare", () => {
  it("keeps the bar inside its row", () => {
    expect(barShare(62.4)).toBe(62.4);
    expect(barShare(-3)).toBe(0);
    expect(barShare(140)).toBe(100);
  });
});

describe("listingLines", () => {
  it("lists title and subtitle against the App Store limits", () => {
    expect(listingLines(listing, "APP_STORE")).toEqual([
      { label: "Title", text: "Focus Timer", count: "11/30", over: false },
      { label: "Subtitle", text: null, count: "0/30", over: false },
    ]);
  });

  it("has no subtitle line on Google Play", () => {
    expect(
      listingLines(listing, "GOOGLE_PLAY").map((line) => line.label),
    ).toEqual(["Title"]);
  });

  it("flags a field over its limit", () => {
    const long = { ...listing, titleChars: 31 };
    expect(listingLines(long, "APP_STORE")[0]).toMatchObject({
      count: "31/30",
      over: true,
    });
  });
});
