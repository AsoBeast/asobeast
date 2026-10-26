import { type Page } from "@playwright/test";
import {
  PLAN_LIMITS,
  UPGRADE_PATH,
  type AccountPlan,
  type AuthUser,
} from "@asobeast/shared";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { fulfillJson, routePlan, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";

const TRIAL_PLAN: AccountPlan = {
  plan: "trial",
  displayName: "Trial",
  billing: true,
  entitled: true,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: "2026-11-02T00:00:00.000Z",
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.trial,
  usage: {
    apps: { used: 1, limit: PLAN_LIMITS.trial.apps },
    keywordMarkets: { used: 20, limit: PLAN_LIMITS.trial.keywordMarkets },
  },
};

const UNCONFIRMED_OWNER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: false,
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: false,
  trialAwaitsConfirmation: true,
  platformOperator: false,
};

function collectDomErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (message: string) => {
    if (/NotFoundError|insertBefore|removeChild/.test(message)) {
      errors.push(message);
    }
  };
  page.on("pageerror", (error) => record(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") record(message.text());
  });
  return errors;
}

async function openUpgrade(page: Page): Promise<void> {
  await seedSession(page);
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: true,
        registrationOpen: true,
        setupRequired: false,
        authenticated: true,
      }),
    ),
  );
  await routePlan(page, TRIAL_PLAN);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        prices: [
          {
            plan: "indie",
            interval: "month",
            priceId: "price_indie_month",
            amountUsd: 10,
          },
        ],
      }),
    ),
  );
  await page.goto("/upgrade");
}

async function translateText(page: Page): Promise<void> {
  await page.locator("main").evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    for (const text of texts.filter((node) => node.data.trim())) {
      const outer = document.createElement("font");
      const inner = document.createElement("font");
      inner.textContent = text.data.toUpperCase();
      outer.append(inner);
      text.replaceWith(outer);
    }
  });
}

test("a translated upgrade page keeps working when checkout starts", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  const checkout = await holdRequest(
    page,
    /\/api\/backend\/billing\/checkout$/,
    "POST",
    (route) => route.fulfill(fulfillJson(503, { message: "Try later" })),
  );
  await openUpgrade(page);
  const choose = await hydrated(
    page.getByRole("button", { name: "Choose Indie" }),
  );

  await translateText(page);
  await choose.click();

  await expect(choose.locator(".animate-spin")).toBeVisible();
  checkout.release();
  await expect(choose.locator(".animate-spin")).toHaveCount(0);
  await expect(choose).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated upgrade page shows the new label of a button it changed", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, UNCONFIRMED_OWNER)),
  );
  const resend = await holdRequest(
    page,
    /\/api\/backend\/auth\/verify\/resend$/,
    "POST",
    (route) => route.fulfill({ status: 204 }),
  );
  await openUpgrade(page);
  const button = await hydrated(
    page.getByRole("button", { name: "Send a new link" }),
  );

  await translateText(page);
  await button.click();

  await expect(button.locator(".animate-spin")).toBeVisible();
  resend.release();
  await expect(
    page.getByRole("button", { name: "New link sent" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
