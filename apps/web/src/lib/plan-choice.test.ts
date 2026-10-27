import { describe, expect, it } from "vitest";
import type { AccountPlan, BillingCatalog } from "@asobeast/shared";
import {
  CHECKOUT_UNCONFIGURED,
  HANDLED_BY_STRIPE,
  PAYMENT_CONFIRMING,
  SOLD_THROUGH_LINK,
  confirmEmailLine,
  confirmEmailParts,
  memberPlanLine,
  paymentNote,
  planAction,
  planActionLabel,
  planCallToAction,
  planCardLabel,
  planStatusLine,
  savingPercent,
  trialBarLine,
  trustLines,
  paywallHeading,
  paywallStatusLine,
  suspensionNotice,
  trialBannerLine,
  trialEndsOn,
  trialPaymentNote,
  trialPriceLabel,
} from "./plan-choice";
import { formatDate } from "./format";

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

describe("a trial offered on the wall", () => {
  const NOW = new Date("2026-10-22T12:00:00.000Z");
  const offered = planOf({
    plan: "free",
    entitled: false,
    subscribed: false,
    hasBillingAccount: false,
    trialOffer: { days: 7 },
  });
  const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");

  it("starts a free trial instead of a checkout", () => {
    expect(planAction(offered, "indie")).toBe("trial");
    expect(planAction(offered, "ultimate")).toBe("trial");
    expect(planActionLabel("trial", "Indie")).toBe("Start free trial");
  });

  it("never offers the trial over a held or pending subscription", () => {
    expect(planAction({ ...offered, subscribed: true }, "indie")).toBe(
      "change",
    );
    expect(
      planAction(
        { ...offered, subscribed: true, subscriptionPending: true },
        "indie",
      ),
    ).toBe("pending");
  });

  it("heads the wall with the trial length", () => {
    expect(paywallHeading(offered)).toBe("Start your 7 day free trial");
    expect(paywallHeading(planOf({ trialOffer: null }))).toBe(
      "Keep optimizing without limits",
    );
    expect(paywallHeading(undefined)).toBe("Keep optimizing without limits");
  });

  it("ends the trial the offered number of days from now", () => {
    expect(trialEndsOn({ days: 7 }, NOW).toISOString()).toBe(
      "2026-10-29T12:00:00.000Z",
    );
  });

  it("names the zero charge, the end date and how to cancel", () => {
    const line = `Pay $0 today. Your trial ends on ${ENDS_ON}, then the plan you choose is charged. Cancel any time from settings.`;

    expect(paywallStatusLine(offered, NOW)).toBe(line);
  });

  it("says when the verified card is charged", () => {
    const catalog: BillingCatalog = { enabled: true, prices: [] };

    expect(trialPaymentNote(catalog, { days: 7 }, NOW)).toBe(
      `${HANDLED_BY_STRIPE} Your card is verified now and charged on ${ENDS_ON}.`,
    );
    expect(trialPaymentNote(catalog, null, NOW)).toBe(HANDLED_BY_STRIPE);
  });

  it("points settings at the wall", () => {
    expect(planStatusLine(offered)).toBe(
      "Start your free trial from the plan page.",
    );
  });
});

describe("a card backed trial", () => {
  const ENDS = "2026-10-27T00:00:00.000Z";
  const TRIALING = planOf({
    plan: "indie",
    entitled: true,
    trialing: true,
    subscribed: true,
    trialEndsAt: ENDS,
    renewsAt: ENDS,
    billingInterval: "month",
    cancelAtPeriodEnd: false,
  });
  const DECLINED =
    "Your trial ended, but the card was declined. Update it in the billing portal to start your plan.";

  it("names the price of the plan it turns into", () => {
    expect(trialPriceLabel(TRIALING)).toBe("$10 per month");
    expect(trialPriceLabel({ ...TRIALING, billingInterval: "year" })).toBe(
      "$100 per year",
    );
    expect(trialPriceLabel({ ...TRIALING, billingInterval: null })).toBeNull();
  });

  it("says when the trial ends and what it costs then", () => {
    expect(planStatusLine(TRIALING)).toBe(
      `Trial until ${formatDate(ENDS)}, then $10 per month.`,
    );
    expect(paywallStatusLine(TRIALING)).toBe(
      `Your trial runs until ${formatDate(ENDS)}, then $10 per month. Change or cancel it in the billing portal.`,
    );
    expect(planAction(TRIALING, "ultimate")).toBe("change");
  });

  it("invents no price for an unknown interval", () => {
    expect(planStatusLine({ ...TRIALING, billingInterval: null })).toBe(
      `Trial until ${formatDate(ENDS)}.`,
    );
  });

  it("says a cancelled trial charges nothing", () => {
    const cancelled = { ...TRIALING, cancelAtPeriodEnd: true };
    const line = `Cancelled. Your trial ends on ${formatDate(ENDS)} and nothing is charged.`;

    expect(planStatusLine(cancelled)).toBe(line);
    expect(paywallStatusLine(cancelled)).toBe(line);
  });

  it("sends a declined first charge to the portal for a new card", () => {
    const declined = planOf({
      plan: "free",
      entitled: false,
      subscribed: true,
      subscriptionStalled: true,
      trialChargeFailed: true,
      trialEndsAt: ENDS,
    });

    expect(planStatusLine(declined)).toBe(DECLINED);
    expect(paywallStatusLine(declined)).toBe(DECLINED);
  });

  it("keeps the stalled sentence for a paying customer that once trialed", () => {
    expect(planStatusLine(stalled)).not.toBe(DECLINED);
    expect(paywallStatusLine(stalled)).not.toBe(DECLINED);
  });

  it("counts down the banner and names the plan and its price", () => {
    expect(trialBannerLine(5, TRIALING)).toBe(
      "Trial ends in 5 days, then Indie at $10 per month.",
    );
    expect(trialBannerLine(1, TRIALING)).toBe(
      "Trial ends in 1 day, then Indie at $10 per month.",
    );
    expect(trialBannerLine(5, undefined)).toBe("Trial ends in 5 days.");
    expect(trialBannerLine(5, { ...TRIALING, cancelAtPeriodEnd: true })).toBe(
      `Trial ends on ${formatDate(ENDS)}. Nothing will be charged.`,
    );
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

describe("confirmEmailLine", () => {
  it("names the address and the trial it leads to", () => {
    expect(confirmEmailLine("owner@example.com", true)).toBe(
      "Thank you for registering. We sent a link to owner@example.com. Open it to continue to your free trial.",
    );
  });

  it("names the address alone when no trial follows", () => {
    expect(confirmEmailLine("owner@example.com", false)).toBe(
      "Thank you for registering. We sent a link to owner@example.com. Open it to continue.",
    );
  });

  it("splits the sentence around the address", () => {
    const parts = confirmEmailParts("owner@example.com", true);

    expect(parts.address).toBe("owner@example.com");
    expect(`${parts.before}${parts.address}${parts.after}`).toBe(
      confirmEmailLine("owner@example.com", true),
    );
  });
});

describe("the wall around the checkout", () => {
  const NOW = new Date("2026-10-22T12:00:00.000Z");
  const ENDS_ON = formatDate("2026-10-29T12:00:00.000Z");

  it("names the trial end, the free days and how to cancel", () => {
    expect(trustLines({ days: 7 }, NOW)).toEqual([
      `No risk: cancel before ${ENDS_ON} and nothing is charged`,
      "Pay nothing for the first 7 days",
      "Cancel any time from settings",
    ]);
  });

  it("names the trial end on the bar", () => {
    expect(trialBarLine({ days: 7 }, NOW)).toBe(
      `Your 7 day trial is 100% free, ending ${ENDS_ON}. Cancel any time from settings.`,
    );
  });

  it("names a plan card by its plan and price", () => {
    expect(planCardLabel("indie", "month", "trial")).toBe(
      "Indie, $10 per month",
    );
    expect(planCardLabel("ultimate", "year", "current")).toBe(
      "Ultimate, $990 per year, current plan",
    );
  });

  it("reads the annual saving from the plan prices", () => {
    expect(savingPercent("indie")).toBe(17);
    expect(savingPercent("ultimate")).toBe(17);
  });
});
