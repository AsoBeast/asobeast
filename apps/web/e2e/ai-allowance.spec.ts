import { type Page } from "@playwright/test";
import {
  PLAN_LIMITS,
  UPGRADE_PATH,
  type AccountPlan,
  type AiCallUsage,
} from "@asobeast/shared";
import { routePlan, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";

const RESETS_AT = "2026-11-01T00:00:00.000Z";

const indiePlan = (aiCalls: AiCallUsage): AccountPlan => ({
  plan: "indie",
  displayName: "Indie",
  billing: true,
  entitled: true,
  hasBillingAccount: true,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  renewsAt: "2026-11-09T00:00:00.000Z",
  upgradeTo: "ultimate",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.indie,
  usage: {
    apps: { used: 3, limit: PLAN_LIMITS.indie.apps },
    keywordMarkets: { used: 240, limit: PLAN_LIMITS.indie.keywordMarkets },
    aiCalls,
  },
});

async function openWithBilling(page: Page, plan: AccountPlan) {
  await seedSession(page);
  await page
    .context()
    .addCookies([
      { name: "e2e_billing", value: "1", domain: "localhost", path: "/" },
    ]);
  await routePlan(page, plan);
}

test("shows the month's ai calls and their renewal on the plan card", async ({
  page,
}) => {
  await openWithBilling(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );

  await page.goto("/settings");

  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("AI calls this month")).toBeVisible();
  await expect(plan.getByText("37 of 200")).toBeVisible();
  await expect(plan.getByText("Renews Nov 1, 2026")).toBeVisible();
  await expect(plan.locator('[data-slot="meter"]')).toHaveCount(3);
});

test("lists the ai calls of each plan on the upgrade page", async ({
  page,
}) => {
  await openWithBilling(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );

  await page.goto("/upgrade");

  const rows = page
    .getByRole("term")
    .filter({ hasText: "AI calls per month" })
    .locator("xpath=..")
    .getByRole("definition");
  await expect(rows).toHaveText(["200", "2,000"]);
});
