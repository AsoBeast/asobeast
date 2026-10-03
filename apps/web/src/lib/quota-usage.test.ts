import { describe, expect, it } from "vitest";
import { formatQuotaUsage, hasNoCapacity } from "./quota-usage";

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
