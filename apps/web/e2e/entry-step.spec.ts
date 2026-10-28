import { formatDate } from "../src/lib/format";
import { COLLECTION_PAUSED } from "../src/lib/plan-choice";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import { OFFERED_PLAN, TRIALING_PLAN, openBilling } from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";

test.describe("an account that owes a step", () => {
  for (const path of ["/", "/apps/app-1", "/settings"]) {
    test(`${path} sends an owner without a plan to the wall`, async ({
      page,
      context,
    }) => {
      await seedViewer(context, "checkout-pending");
      await seedSession(page);
      await openBilling(page, OFFERED_PLAN);

      await page.goto(path);

      await expect(page).toHaveURL(/\/upgrade$/);
    });
  }

  test("sends an unconfirmed owner to confirm the address", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending-unconfirmed");
    await seedSession(page);
    await openBilling(page, OFFERED_PLAN);

    await page.goto("/");

    await expect(page).toHaveURL(/\/confirm-email$/);
  });

  test("waits for the checkout return to reconcile before it sends anywhere", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page, OFFERED_PLAN);
    let reconciles = 0;
    await page.route("**/api/backend/billing/reconcile", async (route) => {
      reconciles += 1;
      await route.fulfill(
        fulfillJson(200, {
          checked: 1,
          corrected: 0,
          orphanSubscriptions: [],
          unreconciled: [],
        }),
      );
    });
    const refetched = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/backend/auth/me") && reconciles > 0,
    );

    await page.goto("/?checkout=complete&session_id=cs_e2e");

    await refetched;
    await expect(page).toHaveURL(/\/upgrade$/);
    expect(reconciles).toBe(1);
  });
});

test.describe("a checkout that started the trial", () => {
  test("stays on the dashboard and welcomes the trial", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page, OFFERED_PLAN);
    let reconciled = false;
    const accountLoaded = page.waitForResponse("**/api/backend/auth/me");
    await page.route("**/api/backend/billing/reconcile", async (route) => {
      await accountLoaded;
      await seedViewer(context, "trialing");
      reconciled = true;
      await route.fulfill(
        fulfillJson(200, {
          checked: 1,
          corrected: 1,
          orphanSubscriptions: [],
          unreconciled: [],
        }),
      );
    });
    await page.route("**/api/backend/auth/plan", (route) =>
      route.fulfill(
        fulfillJson(200, reconciled ? TRIALING_PLAN : OFFERED_PLAN),
      ),
    );

    await page.goto("/?checkout=complete&session_id=cs_e2e");

    await expect(
      page.getByText(
        `Your free trial has started. The first charge is on ${formatDate(TRIALING_PLAN.renewsAt)}.`,
      ),
    ).toBeVisible();
    await expect(page).toHaveURL("http://localhost:3000/");
  });
});

test.describe("an account that owes nothing", () => {
  test("a member of a workspace without a plan stays and is told why", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "lapsed-member");
    await seedSession(page);
    await openBilling(page, { ...OFFERED_PLAN, trialOffer: null });

    await page.goto("/");

    await expect(
      page.getByText(COLLECTION_PAUSED, { exact: false }),
    ).toBeVisible();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("a trialing owner stays and sees the trial", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "trialing");
    await seedSession(page);
    await openBilling(page, TRIALING_PLAN);

    await page.goto("/");

    await expect(
      page.getByText("Trial ends in 5 days, then Indie at $10 per month."),
    ).toBeVisible();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("an owner whose plan lapsed stays with its data", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "lapsed-operator");
    await seedSession(page);
    await openBilling(page, { ...OFFERED_PLAN, trialOffer: null });

    await page.goto("/");

    await expect(
      page.getByText(COLLECTION_PAUSED, { exact: false }),
    ).toBeVisible();
    await expect(page).toHaveURL("http://localhost:3000/");
  });
});
