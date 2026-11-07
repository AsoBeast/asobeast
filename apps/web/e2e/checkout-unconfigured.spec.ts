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

  test("the settings plan card promises no trial either", async ({ page }) => {
    await openUnconfigured(page, "customer");

    await page.goto("/settings");

    await expect(
      page.getByText(
        "Your data stays readable and exportable; tracking resumes when you choose a plan.",
      ),
    ).toBeVisible();
    await expect(page.getByText(/free trial/)).toHaveCount(0);
  });
});

const refusal = (statusCode: number, error: string, message: string) => ({
  statusCode,
  error,
  message,
  path: "/billing/reconcile",
  timestamp: new Date().toISOString(),
});

async function returnFromCheckout(
  page: Page,
  status: number,
  body: unknown,
): Promise<() => number> {
  await seedViewer(page.context(), "checkout-pending");
  await seedSession(page);
  await openBilling(page, OFFERED_PLAN);
  let reconciles = 0;
  await page.route("**/api/backend/billing/reconcile", async (route) => {
    reconciles += 1;
    await route.fulfill(fulfillJson(status, body));
  });
  await page.goto("/?checkout=complete&session_id=cs_e2e");
  return () => reconciles;
}

test.describe("a checkout return the reconcile settles for good", () => {
  test("sends an owner without a plan to the wall after a refusal", async ({
    page,
  }) => {
    const reconciles = await returnFromCheckout(
      page,
      403,
      refusal(403, "Forbidden", "Only the workspace owner can do this."),
    );

    await expect(page).toHaveURL(/\/upgrade$/);
    expect(reconciles()).toBe(1);
  });

  test("sends an owner without a plan to the wall where Stripe is off", async ({
    page,
  }) => {
    const reconciles = await returnFromCheckout(page, 200, {
      checked: 1,
      corrected: 0,
      orphanSubscriptions: [],
      unreconciled: [],
    });

    await expect(page).toHaveURL(/\/upgrade$/);
    expect(reconciles()).toBe(1);
  });
});

test.describe("a checkout return the reconcile cannot settle yet", () => {
  test("keeps the marker after a rate limit so the next load retries", async ({
    page,
  }) => {
    let reconciled = false;
    const refetched = page.waitForResponse(
      (response) => reconciled && response.url().endsWith("/auth/me"),
    );
    page.on("response", (response) => {
      if (response.url().endsWith("/billing/reconcile")) reconciled = true;
    });
    const reconciles = await returnFromCheckout(
      page,
      429,
      refusal(429, "Too Many Requests", "Too many requests. Try again later."),
    );

    await refetched;
    expect(reconciles()).toBe(1);
    await expect(page).toHaveURL(/\/\?checkout=complete&session_id=cs_e2e$/);

    await page.reload();

    await expect.poll(reconciles).toBe(2);
    await expect(page).toHaveURL(/\/\?checkout=complete&session_id=cs_e2e$/);
  });

  test("keeps the marker when the plan read fails after a reconcile", async ({
    page,
  }) => {
    await page.route("**/api/backend/auth/plan", (route) =>
      route.fulfill(
        fulfillJson(
          403,
          refusal(403, "Forbidden", "Only the workspace owner can do this."),
        ),
      ),
    );
    const planRefused = page.waitForResponse((response) =>
      response.url().endsWith("/auth/plan"),
    );
    const reconciles = await returnFromCheckout(page, 200, {
      checked: 1,
      corrected: 1,
      orphanSubscriptions: [],
      unreconciled: [],
    });

    await planRefused;
    await expect.poll(reconciles).toBe(1);
    await expect(page).toHaveURL(/\/\?checkout=complete&session_id=cs_e2e$/);
  });
});
