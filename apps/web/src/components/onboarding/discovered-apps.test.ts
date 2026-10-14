import { describe, expect, it } from "vitest";
import type { CompetitorDiscoveryItem } from "@asobeast/shared";
import {
  DISCOVERED_LIMIT,
  discoveredEmptyText,
  discoveredRows,
} from "./discovered-apps";

const item = (title: string): CompetitorDiscoveryItem => ({
  storeAppId: title,
  title,
  developer: null,
  ratingAvg: null,
  ratingCount: null,
  appearances: 3,
  keywordCount: 2,
  bestPosition: 4,
  avgPosition: 6,
  keywords: [],
});

const discovery = (titles: string[]) => ({
  windowDays: 30,
  items: titles.map(item),
});

describe("discoveredRows", () => {
  it("answers nothing before discovery loads", () => {
    expect(discoveredRows(undefined)).toEqual([]);
  });

  it("keeps the first rows in api order up to the limit", () => {
    const titles = Array.from({ length: 8 }, (_, index) => `App ${index}`);

    expect(discoveredRows(discovery(titles)).map((row) => row.title)).toEqual(
      titles.slice(0, DISCOVERED_LIMIT),
    );
  });
});

describe("discoveredEmptyText", () => {
  it("says positions are still collected while the first run collects", () => {
    expect(discoveredEmptyText(true, 30)).toBe(
      "Positions are still being collected. Apps that rank for your keywords appear here within minutes.",
    );
  });

  it("names the window once collection is over", () => {
    expect(discoveredEmptyText(false, 30)).toBe(
      "Nothing ranks beside you in the last 30 days yet.",
    );
  });
});
