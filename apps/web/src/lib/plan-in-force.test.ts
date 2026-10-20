import { describe, expect, it } from "vitest";
import { planInForce, planInForceLabel } from "./plan-in-force";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const PAST = "2026-10-18T12:00:00.000Z";
const FUTURE = "2026-10-22T12:00:00.000Z";

const terms = (
  plan: string,
  trialEndsAt: string | null,
  planExpiresAt: string | null,
) => ({ plan, trialEndsAt, planExpiresAt });

describe("planInForce", () => {
  it("drops an ended trial to free", () => {
    expect(planInForce(terms("trial", PAST, null), NOW)).toBe("free");
  });

  it("keeps a running trial", () => {
    expect(planInForce(terms("trial", FUTURE, null), NOW)).toBe("trial");
  });

  it("falls back to the running trial when a paid plan has lapsed", () => {
    expect(planInForce(terms("indie", FUTURE, PAST), NOW)).toBe("trial");
  });

  it("drops a lapsed paid plan with no trial to free", () => {
    expect(planInForce(terms("ultimate", null, PAST), NOW)).toBe("free");
  });

  it("keeps a paid plan with no expiry or a future expiry", () => {
    expect(planInForce(terms("indie", null, null), NOW)).toBe("indie");
    expect(planInForce(terms("ultimate", null, FUTURE), NOW)).toBe("ultimate");
  });

  it("prefers a live paid plan over a running trial", () => {
    expect(planInForce(terms("indie", FUTURE, FUTURE), NOW)).toBe("indie");
  });

  it("reads the legacy premium spelling as indie", () => {
    expect(planInForce(terms("premium", null, null), NOW)).toBe("indie");
  });

  it("treats a date equal to now as over", () => {
    expect(planInForce(terms("trial", NOW.toISOString(), null), NOW)).toBe(
      "free",
    );
  });

  it("treats an unknown stored plan with no dates as free", () => {
    expect(planInForce(terms("enterprise", null, null), NOW)).toBe("free");
  });
});

describe("planInForceLabel", () => {
  it("names the plan the way the plan card does", () => {
    expect(planInForceLabel(terms("trial", PAST, null), NOW)).toBe("Free");
    expect(planInForceLabel(terms("indie", FUTURE, PAST), NOW)).toBe("Trial");
    expect(planInForceLabel(terms("indie", null, null), NOW)).toBe("Indie");
    expect(planInForceLabel(terms("ultimate", null, FUTURE), NOW)).toBe(
      "Ultimate",
    );
  });
});
