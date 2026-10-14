import { describe, expect, it } from "vitest";
import type { CompetitorDiscoveryItem, CompetitorItem } from "@asobeast/shared";
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

const competitor = (name: string | null, title?: string): CompetitorItem => ({
  id: `comp-${name ?? title}`,
  store: "APP_STORE",
  name,
  iconUrl: null,
  latestSnapshot: title
    ? {
        id: "snap",
        title,
        subtitle: null,
        summary: null,
        ratingAvg: null,
        ratingCount: null,
        installs: null,
        price: null,
        version: null,
        capturedAt: "2026-10-14T00:00:00.000Z",
      }
    : null,
});

const discovery = (titles: string[]) => ({
  windowDays: 30,
  items: titles.map(item),
});

describe("discoveredRows", () => {
  it("answers nothing before discovery loads", () => {
    expect(discoveredRows(undefined, [])).toEqual([]);
  });

  it("keeps the first rows in api order up to the limit", () => {
    const titles = Array.from({ length: 8 }, (_, index) => `App ${index}`);

    expect(
      discoveredRows(discovery(titles), []).map((row) => row.title),
    ).toEqual(titles.slice(0, DISCOVERED_LIMIT));
  });

  it("leaves out an app already tracked by name or by listing title", () => {
    const rows = discoveredRows(
      discovery(["Tomato Clock", "Deep Work", "Zen"]),
      [competitor("Tomato Clock"), competitor(null, "Deep Work")],
    );

    expect(rows.map((row) => row.title)).toEqual(["Zen"]);
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
