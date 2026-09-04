import { describe, expect, it } from "vitest";
import type { AccountPlan } from "@asobeast/shared";
import {
  planAction,
  planActionLabel,
  planCallToAction,
  planStatusLine,
  paywallStatusLine,
} from "./plan-choice";

const planOf = (over: Partial<AccountPlan> = {}): AccountPlan =>
  ({
    plan: "indie",
    displayName: "Indie",
    billing: true,
    entitled: true,
    hasBillingAccount: true,
    subscribed: true,
    subscriptionStalled: false,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    renewsAt: null,
    ...over,
  }) as AccountPlan;

const stalled = planOf({
  plan: "free",
  entitled: false,
  subscribed: true,
  subscriptionStalled: true,
  trialEndsAt: "2026-09-01T00:00:00.000Z",
});

const drifted = planOf({
  plan: "free",
  entitled: false,
  subscribed: true,
  subscriptionStalled: false,
  trialEndsAt: null,
});

const lapsedTrial = planOf({
  plan: "free",
  entitled: false,
  subscribed: false,
  trialEndsAt: "2026-09-01T00:00:00.000Z",
});

describe("planAction", () => {
  it("marks the plan the workspace is already on", () => {
    expect(planAction(planOf(), "indie")).toBe("current");
  });

  it("sells to a workspace that holds no subscription", () => {
    expect(planAction(lapsedTrial, "indie")).toBe("checkout");
  });

  it("sells to a workspace whose plan is not loaded yet", () => {
    expect(planAction(undefined, "indie")).toBe("checkout");
  });

  it("sends a paying workspace to the portal to change plan", () => {
    expect(planAction(planOf(), "ultimate")).toBe("change");
  });

  it("never offers a checkout a held subscription would refuse", () => {
    expect(planAction(stalled, "indie")).toBe("resume");
    expect(planAction(stalled, "ultimate")).toBe("resume");
  });

  it("does not offer a resume for a live subscription local state lags behind", () => {
    expect(planAction(drifted, "indie")).toBe("change");
  });
});

describe("planActionLabel", () => {
  it("names the plan it is selling", () => {
    expect(planActionLabel("checkout", "Indie")).toBe("Choose Indie");
  });

  it("tells a stalled subscription it is resuming, not buying", () => {
    expect(planActionLabel("resume", "Indie")).toBe(
      "Resume in the billing portal",
    );
  });

  it("keeps the plan change wording for a paying workspace", () => {
    expect(planActionLabel("change", "Ultimate")).toBe(
      "Change in the billing portal",
    );
  });
});

describe("paywallStatusLine", () => {
  it("asks a fresh workspace to choose", () => {
    expect(paywallStatusLine(undefined)).toContain("Choose a plan");
  });

  it("counts down an active trial", () => {
    const line = paywallStatusLine(
      planOf({ plan: "trial", trialEndsAt: "2026-09-30T00:00:00.000Z" }),
    );

    expect(line).toContain("trial is active");
  });

  it("blames the payment method rather than the trial when a subscription stalled", () => {
    const line = paywallStatusLine(stalled);

    expect(line).toContain("stopped collecting");
    expect(line).not.toContain("trial ended");
  });

  it("still explains a trial that simply ran out", () => {
    expect(paywallStatusLine(lapsedTrial)).toContain("trial ended");
  });

  it("does not blame the payment method of a subscription that is collecting", () => {
    expect(paywallStatusLine(drifted)).not.toContain("stopped collecting");
  });

  it("names the renewal date of a paid plan", () => {
    const line = paywallStatusLine(
      planOf({ renewsAt: "2026-10-01T00:00:00.000Z" }),
    );

    expect(line).toContain("Indie");
    expect(line).toContain("renews");
  });
});

describe("planStatusLine", () => {
  it("tells a stalled subscription what restarts tracking", () => {
    expect(planStatusLine(stalled)).toContain("payment method");
  });

  it("keeps the data reassurance for a workspace with no subscription", () => {
    expect(planStatusLine(lapsedTrial)).toContain("readable and exportable");
  });

  it("reports a cancellation that has not taken effect yet", () => {
    const line = planStatusLine(
      planOf({ cancelAtPeriodEnd: true, renewsAt: "2026-10-01T00:00:00.000Z" }),
    );

    expect(line).toContain("Cancelled");
  });
});

describe("planCallToAction", () => {
  it("offers the upgrade an entitled workspace can take", () => {
    expect(planCallToAction(planOf())).toBe("Upgrade plan");
  });

  it("offers to resume rather than to choose again", () => {
    expect(planCallToAction(stalled)).toBe("Resume plan");
  });

  it("offers a plan to a workspace that holds none", () => {
    expect(planCallToAction(lapsedTrial)).toBe("Choose a plan");
  });

  it("does not offer a resume for a subscription that never stalled", () => {
    expect(planCallToAction(drifted)).toBe("Choose a plan");
  });
});
