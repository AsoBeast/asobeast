import { describe, expect, it } from "vitest";
import {
  formatQuotaUsage,
  hasNoCapacity,
  keywordLimitExceededSince,
} from "./quota-usage";

describe("formatQuotaUsage", () => {
  it("reads usage against a limit as of", () => {
    expect(formatQuotaUsage({ used: 3, limit: 5 })).toBe("3 of 5");
  });

  it("groups thousands on both numbers", () => {
    expect(formatQuotaUsage({ used: 1240, limit: 10000 })).toBe(
      "1,240 of 10,000",
    );
  });

  it("names an unlimited allowance", () => {
    expect(formatQuotaUsage({ used: 12, limit: null })).toBe("12 of Unlimited");
  });

  it("reads a plan with no capacity as tracked, never as over a limit of zero", () => {
    expect(formatQuotaUsage({ used: 7, limit: 0 })).toBe(
      "7 tracked, none included",
    );
    expect(formatQuotaUsage({ used: 0, limit: 0 })).toBe(
      "0 tracked, none included",
    );
  });

  it("names what a plan without capacity counts", () => {
    expect(formatQuotaUsage({ used: 0, limit: 0 }, "used")).toBe(
      "0 used, none included",
    );
    expect(formatQuotaUsage({ used: 3, limit: 0 })).toBe(
      "3 tracked, none included",
    );
  });

  it("keeps a real overage as a count against its limit", () => {
    expect(formatQuotaUsage({ used: 1200, limit: 1000 })).toBe(
      "1,200 of 1,000",
    );
  });
});

describe("hasNoCapacity", () => {
  it("is true only for a limit of zero", () => {
    expect(hasNoCapacity({ used: 7, limit: 0 })).toBe(true);
    expect(hasNoCapacity({ used: 7, limit: 5 })).toBe(false);
    expect(hasNoCapacity({ used: 7, limit: null })).toBe(false);
  });
});

describe("keywordLimitExceededSince", () => {
  const SINCE = "2026-09-30T03:00:00.000Z";

  it("names when a workspace went over its keyword limit", () => {
    expect(
      keywordLimitExceededSince({
        plan: "indie",
        apps: { used: 2, limit: 3 },
        keywordMarkets: { used: 240, limit: 200 },
        overLimitSince: SINCE,
      }),
    ).toBe(SINCE);
  });

  it("stays quiet for a workspace whose plan includes no keywords", () => {
    expect(
      keywordLimitExceededSince({
        plan: "free",
        apps: { used: 3, limit: 0 },
        keywordMarkets: { used: 240, limit: 0 },
        overLimitSince: SINCE,
      }),
    ).toBeNull();
  });

  it("stays quiet without quota or without an over limit date", () => {
    expect(keywordLimitExceededSince(null)).toBeNull();
    expect(
      keywordLimitExceededSince({
        plan: "indie",
        apps: { used: 1, limit: 3 },
        keywordMarkets: { used: 10, limit: 200 },
        overLimitSince: null,
      }),
    ).toBeNull();
  });
});
