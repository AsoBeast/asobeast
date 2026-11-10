import { type Page, type Route } from "@playwright/test";
import { type AccountPlan } from "@asobeast/shared";
import { holdRequest } from "./held-request.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import {
  CATALOG,
  OFFERED_PLAN,
  TRIALING_PLAN,
  openBilling,
} from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";
import {
  PLAN_UNREACHABLE,
  PRICES_UNREACHABLE,
  paywallHeading,
} from "../src/lib/plan-choice";

const TRIAL_BUTTON = "Pay $0 today and start your free trial";
const UNCONFIGURED = "Checkout is not configured on this instance.";

async function openWall(page: Page, plan: AccountPlan = OFFERED_PLAN) {
  await seedViewer(page.context(), "checkout-pending");
  await seedSession(page);
  await openBilling(page, plan);
}

function loseFirst(
  page: Page,
  path: string,
  answer: (route: Route) => Promise<void>,
): Promise<() => number> {
  let reads = 0;
  return page
    .route(`**/api/backend${path}`, (route) => {
      reads += 1;
      return reads === 1 ? route.abort("failed") : answer(route);
    })
    .then(() => () => reads);
}

test.describe("the billing wall when a read is lost", () => {
  test("offers a retry rather than a checkout when the plan read is lost", async ({
    page,
  }) => {
    await openWall(page);
    const reads = await loseFirst(page, "/auth/plan", (route) =>
      route.fulfill(fulfillJson(200, OFFERED_PLAN)),
    );

    await page.goto("/upgrade");

    await expect(
      page.getByRole("alert").filter({ hasText: PLAN_UNREACHABLE }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^(Choose|Pay \$0)/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Retry" }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: paywallHeading(OFFERED_PLAN),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: TRIAL_BUTTON }),
    ).toBeEnabled();
    expect(reads()).toBe(2);
  });

  test("names the lost prices instead of an unconfigured checkout", async ({
    page,
  }) => {
    await openWall(page);
    const reads = await loseFirst(page, "/billing/catalog", (route) =>
      route.fulfill(fulfillJson(200, CATALOG)),
    );

    await page.goto("/upgrade");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: paywallHeading(OFFERED_PLAN),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: PRICES_UNREACHABLE }),
    ).toBeVisible();
    await expect(page.getByText(UNCONFIGURED)).toHaveCount(0);
    await expect(page.getByRole("button", { name: TRIAL_BUTTON })).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByText(PRICES_UNREACHABLE)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: TRIAL_BUTTON }),
    ).toBeEnabled();
    expect(reads()).toBe(2);
  });

  test("keeps the billing portal open to a customer while the prices are lost", async ({
    page,
  }) => {
    await openWall(page, TRIALING_PLAN);
    await loseFirst(page, "/billing/catalog", (route) =>
      route.fulfill(fulfillJson(200, CATALOG)),
    );

    await page.goto("/upgrade?plan=ultimate");

    await expect(
      page.getByRole("alert").filter({ hasText: PRICES_UNREACHABLE }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change in the billing portal" }),
    ).toBeEnabled();
  });

  test("shows no unconfigured checkout while the prices load", async ({
    page,
  }) => {
    await openWall(page);
    const catalog = await holdRequest(
      page,
      /\/api\/backend\/billing\/catalog$/,
      "GET",
      (route) => route.fulfill(fulfillJson(200, CATALOG)),
    );
    const planRead = page.waitForResponse("**/api/backend/auth/plan");

    await page.goto("/upgrade");
    await planRead;

    await expect(
      page.getByRole("status", { name: "Checking your session" }),
    ).toBeVisible();
    await expect(page.getByText(UNCONFIGURED)).toHaveCount(0);
    catalog.release();
    await expect(
      page.getByRole("button", { name: TRIAL_BUTTON }),
    ).toBeEnabled();
    await expect(page.getByText(UNCONFIGURED)).toHaveCount(0);
  });

  test("keeps the wall it showed when a reconnect loses the plan read", async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.clock.install();
    await openWall(page);

    await page.goto("/upgrade");
    await expect(
      page.getByRole("button", { name: TRIAL_BUTTON }),
    ).toBeEnabled();

    await page.route("**/api/backend/auth/plan", (route) =>
      route.abort("failed"),
    );
    const refetch = page.waitForRequest("**/api/backend/auth/plan");
    await page.clock.fastForward(60_000);
    await context.setOffline(true);
    await context.setOffline(false);
    await refetch;

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: paywallHeading(OFFERED_PLAN),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: TRIAL_BUTTON }),
    ).toBeEnabled();
    await expect(page.getByText(PLAN_UNREACHABLE)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
