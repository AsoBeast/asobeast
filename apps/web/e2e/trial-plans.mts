import { type Page } from "@playwright/test";
import {
  PLAN_LIMITS,
  UPGRADE_PATH,
  type AccountPlan,
  type BillingCatalog,
} from "@asobeast/shared";
import { fulfillJson, seedPlan } from "./plan-helpers.mts";

export const OFFERED_PLAN: AccountPlan = {
  plan: "free",
  displayName: "Free",
  billing: true,
  entitled: false,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.free,
  trialOffer: { days: 7 },
  trialing: false,
  billingInterval: null,
  usage: {
    apps: { used: 0, limit: PLAN_LIMITS.free.apps },
    keywordMarkets: { used: 0, limit: PLAN_LIMITS.free.keywordMarkets },
  },
};

export const CATALOG: BillingCatalog = {
  enabled: true,
  prices: [
    {
      plan: "indie",
      interval: "month",
      priceId: "price_indie_month",
      amountUsd: 10,
    },
    {
      plan: "indie",
      interval: "year",
      priceId: "price_indie_year",
      amountUsd: 100,
    },
    {
      plan: "ultimate",
      interval: "month",
      priceId: "price_ultimate_month",
      amountUsd: 99,
    },
    {
      plan: "ultimate",
      interval: "year",
      priceId: "price_ultimate_year",
      amountUsd: 990,
    },
  ],
};

export async function openBilling(
  page: Page,
  plan: AccountPlan = OFFERED_PLAN,
) {
  await page
    .context()
    .addCookies([
      { name: "e2e_billing", value: "1", domain: "localhost", path: "/" },
    ]);
  await seedPlan(page, plan);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(fulfillJson(200, CATALOG)),
  );
}

export async function openRegistration(page: Page) {
  await page.context().addCookies([
    {
      name: "e2e_setup_required",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const endsIn = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString();

export const TRIALING_PLAN: AccountPlan = {
  ...OFFERED_PLAN,
  plan: "indie",
  displayName: "Indie",
  entitled: true,
  subscribed: true,
  hasBillingAccount: true,
  trialOffer: null,
  trialing: true,
  billingInterval: "month",
  trialEndsAt: endsIn(5),
  renewsAt: endsIn(5),
  limits: { ...PLAN_LIMITS.indie, aiCallsPerMonth: 25 },
  usage: {
    apps: { used: 1, limit: PLAN_LIMITS.indie.apps },
    keywordMarkets: { used: 12, limit: PLAN_LIMITS.indie.keywordMarkets },
    aiCalls: { used: 3, limit: 25, resetsAt: endsIn(20) },
  },
};

export const DECLINED_PLAN: AccountPlan = {
  ...OFFERED_PLAN,
  subscribed: true,
  hasBillingAccount: true,
  trialOffer: null,
  subscriptionStalled: true,
  trialChargeFailed: true,
  trialEndsAt: endsIn(-1),
};

export function planCookie(plan: AccountPlan): string {
  return Buffer.from(JSON.stringify(plan)).toString("base64url");
}
