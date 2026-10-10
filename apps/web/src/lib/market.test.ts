import { describe, expect, it } from "vitest";
import type { ListingMarket } from "@asobeast/shared";
import {
  ALL_MARKETS,
  isRefreshable,
  keywordScope,
  marketLabel,
  queryMarket,
  resolveLocalization,
  resolveMarket,
} from "./market";

const MARKETS: ListingMarket[] = [
  { country: "us", home: true, capturedAt: "2026-07-01T00:00:00.000Z" },
  { country: "de", home: false, capturedAt: "2026-07-02T00:00:00.000Z" },
];

describe("resolveMarket", () => {
  it("keeps a market that has a listing", () => {
    expect(resolveMarket("de", MARKETS, "us")).toBe("de");
  });

  it("falls back to the home market for a market without a listing", () => {
    expect(resolveMarket("pl", MARKETS, "us")).toBe("us");
  });

  it("falls back to the home market when none is requested", () => {
    expect(resolveMarket("", MARKETS, "us")).toBe("us");
  });

  it("falls back to the home market when no market is known", () => {
    expect(resolveMarket("de", [], "us")).toBe("us");
  });
});

describe("queryMarket", () => {
  it("sends no market for the home storefront", () => {
    expect(queryMarket("us", "us")).toBeUndefined();
  });

  it("sends the market for any other storefront", () => {
    expect(queryMarket("de", "us")).toBe("de");
  });
});

describe("marketLabel", () => {
  it("names the home storefront as home", () => {
    expect(marketLabel(MARKETS[0])).toBe("US · United States (home)");
  });

  it("names another storefront", () => {
    expect(marketLabel(MARKETS[1])).toBe("DE · Germany");
  });
});

describe("isRefreshable", () => {
  const markets: ListingMarket[] = [
    ...MARKETS,
    {
      country: "fr",
      home: false,
      capturedAt: "2026-07-03T00:00:00.000Z",
      tracked: false,
    },
  ];

  it("refreshes a market that still tracks keywords", () => {
    expect(isRefreshable(markets, "de")).toBe(true);
  });

  it("refreshes the home market", () => {
    expect(isRefreshable(markets, "us")).toBe(true);
  });

  it("refuses a market whose keywords were removed", () => {
    expect(isRefreshable(markets, "fr")).toBe(false);
  });
});

describe("resolveLocalization", () => {
  const markets: ListingMarket[] = [
    { country: "us", home: true, capturedAt: null },
    { country: "pl", home: false, capturedAt: null, localizations: ["pl"] },
  ];

  it("keeps a localization the market captured", () => {
    expect(resolveLocalization("pl", markets, "pl")).toBe("pl");
  });

  it("falls back to the default listing for one it did not capture", () => {
    expect(resolveLocalization("tr", markets, "pl")).toBeNull();
  });

  it("falls back to the default listing for a localization of another market", () => {
    expect(resolveLocalization("pl", markets, "us")).toBeNull();
  });

  it("reads the default listing when none is requested", () => {
    expect(resolveLocalization(null, markets, "pl")).toBeNull();
  });
});

describe("keywordScope", () => {
  it("narrows the numbers to the selected market", () => {
    expect(keywordScope("de", "de")).toBe("de");
  });

  it("narrows to the home market when none is requested", () => {
    expect(keywordScope("", "us")).toBe("us");
  });

  it("covers every market when all markets are requested", () => {
    expect(keywordScope(ALL_MARKETS, "us")).toBeUndefined();
  });
});
