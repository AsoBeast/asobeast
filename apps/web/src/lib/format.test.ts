import { describe, expect, it } from "vitest";
import {
  formatCategoryPosition,
  formatCompact,
  formatCountry,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatMeasure,
  formatNumber,
  formatPrice,
  formatRating,
  formatRelativeTime,
  storeLabel,
} from "./format";

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("renders zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("keeps the precision a caller passes", () => {
    expect(formatNumber(0.25)).toBe("0.25");
  });
});

describe("formatMeasure", () => {
  it.each([
    [45.43165338804846, "45.4"],
    [60.24, "60.2"],
    [62, "62"],
    [1234.56, "1,234.6"],
  ])("renders %s as %s", (value, expected) => {
    expect(formatMeasure(value)).toBe(expected);
  });
});

describe("formatCompact", () => {
  it.each([
    [999, "999"],
    [1500, "1.5K"],
    [1000000, "1M"],
  ])("renders %s as %s", (value, expected) => {
    expect(formatCompact(value)).toBe(expected);
  });
});

describe("formatRating", () => {
  it.each([
    [4.5, "4.5"],
    [4, "4.0"],
    [0, "0.0"],
  ])("renders %s with one decimal", (value, expected) => {
    expect(formatRating(value)).toBe(expected);
  });
});

describe("formatPrice", () => {
  it("renders a zero price as free", () => {
    expect(formatPrice(0)).toBe("Free");
  });

  it("renders a paid price as currency", () => {
    expect(formatPrice(4.99)).toBe("$4.99");
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-01-01", "Jan 1, 2026"],
    ["2026-12-31", "Dec 31, 2026"],
  ])("renders the utc date %s as %s", (value, expected) => {
    expect(formatDate(value)).toBe(expected);
  });

  it("renders a placeholder for a missing date", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("renders a placeholder for an empty date", () => {
    expect(formatDate("")).toBe("—");
  });
});

describe("formatDayMonth", () => {
  it("renders the utc day and month", () => {
    expect(formatDayMonth("2026-01-01")).toBe("Jan 1");
  });
});

describe("formatDateTime", () => {
  it.each([
    ["2026-01-01T00:00:00.000Z", "Jan 1, 2026, 12:00 AM UTC"],
    ["2026-07-04T13:45:00.000Z", "Jul 4, 2026, 1:45 PM UTC"],
  ])("renders %s as %s", (value, expected) => {
    expect(formatDateTime(value)).toBe(expected);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-01-10T12:00:00.000Z");

  it.each([
    ["2026-01-09T12:00:00.000Z", "yesterday"],
    ["2026-01-12T12:00:00.000Z", "in 2 days"],
    ["2026-01-10T09:00:00.000Z", "3 hours ago"],
    ["2026-01-10T11:55:00.000Z", "5 minutes ago"],
    ["2026-01-10T11:59:30.000Z", "30 seconds ago"],
    ["2025-01-10T12:00:00.000Z", "last year"],
  ])("renders %s as %s", (value, expected) => {
    expect(formatRelativeTime(value, now)).toBe(expected);
  });
});

describe("formatCategoryPosition", () => {
  it.each([
    [1, "1"],
    [200, "200"],
  ])("renders the ranked position %s as %s", (value, expected) => {
    expect(formatCategoryPosition(value)).toBe(expected);
  });

  it("renders an unfound position as out of depth", () => {
    expect(formatCategoryPosition(null)).toBe(">200");
  });

  it.each([[0], [-1]])(
    "never renders the out of range position %s verbatim",
    (value) => {
      expect(formatCategoryPosition(value)).toBe(">200");
    },
  );
});

describe("storeLabel", () => {
  it.each([
    ["APP_STORE", "App Store"],
    ["GOOGLE_PLAY", "Google Play"],
  ] as const)("labels %s as %s", (store, expected) => {
    expect(storeLabel(store)).toBe(expected);
  });
});

describe("formatCountry", () => {
  it.each([
    ["us", "United States"],
    ["gb", "United Kingdom"],
  ])("names the storefront %s", (code, expected) => {
    expect(formatCountry(code)).toBe(expected);
  });

  it("falls back to the uppercased code for an unknown region", () => {
    expect(formatCountry("xx")).toBe("XX");
  });

  it("falls back to the uppercased code when the region lookup throws", () => {
    expect(formatCountry("u")).toBe("U");
  });
});
