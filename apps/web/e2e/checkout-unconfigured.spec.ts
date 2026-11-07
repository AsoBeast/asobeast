import { type Page } from "@playwright/test";
import { holdRequest } from "./held-request.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import { OFFERED_PLAN, openBilling } from "./trial-plans.mts";
import { seedViewer, type Viewer } from "./viewer.mts";

async function openUnconfigured(page: Page, viewer: Viewer) {
  await seedViewer(page.context(), viewer);
  await seedSession(page);
  await openBilling(page, OFFERED_PLAN);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(fulfillJson(200, { enabled: false, prices: [] })),
  );
}

test.describe("a Stripe instance whose catalog has not answered", () => {
  test("the wall keeps the trial while the catalog fails", async ({ page }) => {
    await seedViewer(page.context(), "checkout-pending");
    await seedSession(page);
    await openBilling(page, OFFERED_PLAN);
    await page.route("**/api/backend/billing/catalog", (route) =>
      route.fulfill(
        fulfillJson(500, {
          statusCode: 500,
          error: "Internal Server Error",
          message: "Internal server error",
          path: "/billing/catalog",
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    await page.goto("/upgrade");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Start your 7 day free trial",
      }),
    ).toBeVisible();
  });

  test("the confirmation page keeps the trial while the catalog loads", async ({
    page,
  }) => {
    await seedViewer(page.context(), "checkout-pending-unconfirmed");
    await seedSession(page);
    await openBilling(page, OFFERED_PLAN);
    const catalog = await holdRequest(page, /\/billing\/catalog$/, "GET");

    await page.goto("/confirm-email");

    await expect(
      page.getByText(
        "Thank you for registering. We sent a link to owner@example.com. Open it to continue to your free trial.",
        { exact: true },
      ),
    ).toBeVisible();
    catalog.release();
  });
});

test.describe("an instance whose checkout is not configured", () => {
  test("the wall promises no trial it cannot start", async ({ page }) => {
    await openUnconfigured(page, "checkout-pending");

    await page.goto("/upgrade");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Keep optimizing without limits",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Checkout is not configured on this instance."),
    ).toBeVisible();
    await expect(page.getByText(/free trial|trial is|\$0/)).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Why the trial is safe" }),
    ).toHaveCount(0);
  });

  test("the confirmation page promises no trial either", async ({ page }) => {
    await openUnconfigured(page, "checkout-pending-unconfirmed");

    await page.goto("/confirm-email");

    await expect(
      page.getByText(
        "Thank you for registering. We sent a link to owner@example.com. Open it to continue.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText(/free trial/)).toHaveCount(0);
  });
});
