import { describe, expect, it } from "vitest";
import type { AccountPlan, BillingCatalog } from "@asobeast/shared";
import {
  CHECKOUT_UNCONFIGURED,
  HANDLED_BY_STRIPE,
  PAYMENT_CONFIRMING,
  SOLD_THROUGH_LINK,
  billingNote,
  memberPlanLine,
  paymentNote,
  planAction,
  planActionLabel,
  planCallToAction,
  planStatusLine,
  paywallStatusLine,
  suspensionNotice,
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

const pending = planOf({
  plan: "free",
  entitled: false,
  subscribed: true,
  subscriptionPending: true,
  trialEndsAt: "2026-09-01T00:00:00.000Z",
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

describe("a first payment still being confirmed", () => {
  it("waits on every paid plan instead of selling or sending to the portal", () => {
    expect(planAction(pending, "indie")).toBe("pending");
    expect(planAction(pending, "ultimate")).toBe("pending");
    expect(planActionLabel("pending", "Indie")).toBe("Confirming your payment");
  });

  it("says the payment is confirming on the paywall and in settings", () => {
    expect(paywallStatusLine(pending)).toBe(PAYMENT_CONFIRMING);
    expect(planStatusLine(pending)).toBe(PAYMENT_CONFIRMING);
  });

  it("says the payment is confirming ahead of a trial that is still running", () => {
    const trialing = { ...pending, plan: "trial" as const };

    expect(paywallStatusLine(trialing)).toBe(PAYMENT_CONFIRMING);
    expect(planAction(trialing, "indie")).toBe("pending");
  });

  it("still marks the plan a pending workspace is already on", () => {
    expect(planAction({ ...pending, plan: "indie" }, "indie")).toBe("current");
  });
});

describe("a trial that waits on the email confirmation", () => {
  const CONFIRM_EMAIL_TO_START_TRIAL =
    "Confirm your email to start your free trial.";

  const unconfirmed = planOf({
    plan: "free",
    entitled: false,
    subscribed: false,
    trialEndsAt: null,
  });

  it("asks for the confirmation on the paywall instead of asking for a plan", () => {
    const line = paywallStatusLine(unconfirmed, true);

    expect(line).toContain(CONFIRM_EMAIL_TO_START_TRIAL);
    expect(line).not.toContain("Choose a plan");
  });

  it("asks for it before the plan has loaded", () => {
    expect(paywallStatusLine(undefined, true)).toContain(
      CONFIRM_EMAIL_TO_START_TRIAL,
    );
  });

  it("asks for it in settings without promising that a plan resumes tracking", () => {
    const line = planStatusLine(unconfirmed, true);

    expect(line).toContain(CONFIRM_EMAIL_TO_START_TRIAL);
    expect(line).not.toContain("choose a plan");
  });

  it("keeps asking for a plan when nothing waits on a confirmation", () => {
    expect(paywallStatusLine(unconfirmed, false)).toContain("Choose a plan");
    expect(paywallStatusLine(unconfirmed)).toContain("Choose a plan");
    expect(planStatusLine(unconfirmed)).toContain("readable and exportable");
  });

  it("still says the payment is confirming when one is in flight", () => {
    expect(paywallStatusLine(pending, true)).toBe(PAYMENT_CONFIRMING);
    expect(planStatusLine(pending, true)).toBe(PAYMENT_CONFIRMING);
  });

  it("still sends a stalled subscription to the billing portal", () => {
    expect(paywallStatusLine(stalled, true)).toContain("stopped collecting");
    expect(planStatusLine(stalled, true)).toContain("payment method");
  });

  it("never replaces the account of a trial that already ended", () => {
    expect(paywallStatusLine(lapsedTrial, false)).toContain("trial ended");
  });
});

describe("paymentNote", () => {
  const catalogOf = (over: Partial<BillingCatalog> = {}): BillingCatalog => ({
    enabled: true,
    prices: [],
    ...over,
  });

  it("names link as the reseller and the tax line under managed payments", () => {
    expect(paymentNote(catalogOf({ managedPayments: true }))).toBe(
      SOLD_THROUGH_LINK,
    );
    expect(SOLD_THROUGH_LINK).toContain("Link");
    expect(SOLD_THROUGH_LINK).toContain("VAT");
    expect(SOLD_THROUGH_LINK).toContain("local currency");
  });

  it("keeps today's sentence when this business sells", () => {
    expect(paymentNote(catalogOf({ managedPayments: false }))).toBe(
      HANDLED_BY_STRIPE,
    );
    expect(paymentNote(catalogOf())).toBe(HANDLED_BY_STRIPE);
  });

  it("says checkout is off before it says who sells", () => {
    expect(
      paymentNote(catalogOf({ enabled: false, managedPayments: true })),
    ).toBe(CHECKOUT_UNCONFIGURED);
    expect(paymentNote(undefined)).toBe(CHECKOUT_UNCONFIGURED);
  });
});

describe("memberPlanLine", () => {
  it("tells a member of a paused workspace the data stays and the owner must act", () => {
    const line = memberPlanLine(lapsedTrial);

    expect(line).toContain("Collection is paused");
    expect(line).toContain("readable and exportable");
    expect(line).toContain("owner");
  });

  it("tells a member of a paying workspace that only the owner changes it", () => {
    expect(memberPlanLine(planOf())).toBe(
      "Only the workspace owner can change the plan or the payment method.",
    );
  });

  it("does not claim a pause before the plan has loaded", () => {
    expect(memberPlanLine(undefined)).not.toContain("paused");
  });
});

describe("billingNote", () => {
  it("says how a monthly plan bills without repeating its price", () => {
    expect(billingNote("month")).toBe("Billed monthly");
  });

  it("says what a yearly plan saves without repeating its price", () => {
    expect(billingNote("year")).toBe("Billed yearly, two months free");
  });

  it("never prints a price, which the card title already carries", () => {
    expect(billingNote("month")).not.toMatch(/[$/]/);
    expect(billingNote("year")).not.toMatch(/[$/]/);
  });
});

describe("suspensionNotice", () => {
  it("names the reason the operator recorded and what stays open", () => {
    expect(suspensionNotice("scraping the service")).toBe(
      "This workspace is suspended: scraping the service. Your data stays readable and exportable and billing stays open, but changes and the daily run are paused. Contact the operator of this instance to lift it.",
    );
  });

  it.each([null, undefined, "", "   "])(
    "says only that the workspace is suspended for the reason %j",
    (reason) => {
      expect(suspensionNotice(reason)).toMatch(
        /^This workspace is suspended\. Your data stays/,
      );
    },
  );

  it("does not double the full stop a reason ends with", () => {
    expect(suspensionNotice("Sustained abuse.")).toMatch(
      /^This workspace is suspended: Sustained abuse\. Your data stays/,
    );
  });
});
