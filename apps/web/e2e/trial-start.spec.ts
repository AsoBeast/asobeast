import { formatDate } from "../src/lib/format";
import { type Page } from "@playwright/test";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import {
  CATALOG,
  DAY_MS,
  OFFERED_PLAN,
  openBilling,
  openRegistration,
} from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";

async function register(page: Page, path = "/register") {
  await page.goto(path);
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("the billing wall", () => {
  test("registration lands on the wall with the trial offered", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await openRegistration(page);
    await openBilling(page);

    await register(page);

    await expect(page).toHaveURL(/\/upgrade$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Start your 7 day free trial",
      }),
    ).toBeVisible();
    const endsOn = formatDate(new Date(Date.now() + 7 * DAY_MS).toISOString());
    await expect(
      page.getByText(
        `Pay $0 today. Your trial ends on ${endsOn}, then the plan you choose is charged. Cancel any time from settings.`,
      ),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Monthly" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Selected Indie" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Select Ultimate" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Start free trial" }),
    ).toBeEnabled();
  });

  test("an unconfirmed account sees the confirmation line and is not stopped", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending-unconfirmed");
    await openRegistration(page);
    await openBilling(page);

    await register(page);

    await expect(page).toHaveURL(/\/upgrade$/);
    await expect(
      page.getByText(
        "We sent a confirmation link to owner@example.com. You can start the trial now and confirm later.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send a new link" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start free trial" }),
    ).toBeEnabled();
  });

  test("a preselected plan is honoured and the picker keeps the url", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await openRegistration(page);
    await openBilling(page);

    await register(page, "/register?plan=ultimate");

    await expect(page).toHaveURL(/\/upgrade\?plan=ultimate$/);
    await expect(
      page.getByRole("button", { name: "Selected Ultimate" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { level: 2, name: "Ultimate" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Select Indie" }).click();

    await expect(page).toHaveURL(/\/upgrade\?plan=indie$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Indie" }),
    ).toBeVisible();
  });

  test("starting the trial posts the selected price to hosted checkout", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    let requested: unknown = null;
    await page.route("**/api/backend/billing/checkout", async (route) => {
      requested = route.request().postDataJSON();
      await route.fulfill(
        fulfillJson(200, { url: "http://localhost:3000/?checkout=hosted" }),
      );
    });

    await page.goto("/upgrade");
    await page.getByRole("tab", { name: "Annual" }).click();
    await page.getByRole("button", { name: "Start free trial" }).click();

    await expect
      .poll(() => requested)
      .toEqual({ priceId: "price_indie_year", ui: "hosted" });
    await expect(page).toHaveURL(/checkout=hosted/);
  });

  test("confirming lands an account without a plan on the wall", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending-unconfirmed");
    await openBilling(page);

    await page.goto("/verify?token=abc");
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await expect(page).toHaveURL(/\/upgrade$/);
  });

  test("confirming lands a member of a paying workspace in the application", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "member");

    await page.goto("/verify?token=abc");
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test.describe("with a publishable key", () => {
    const STRIPE_STUB = `
      window.Stripe = function () {
        return {
          createEmbeddedCheckoutPage: async ({ fetchClientSecret }) => {
            const secret = await fetchClientSecret();
            return {
              mount: (target) => target.setAttribute("data-mounted", secret),
              unmount: () => {},
              destroy: () => {},
            };
          },
        };
      };
      window.Stripe.version = "endive";
    `;

    test("mounts the embedded checkout and remounts it per plan and interval", async ({
      page,
      context,
    }) => {
      await seedViewer(context, "checkout-pending");
      await seedSession(page);
      await openBilling(page);
      await page.route("**/api/backend/billing/catalog", (route) =>
        route.fulfill(
          fulfillJson(200, { ...CATALOG, publishableKey: "pk_test_e2e" }),
        ),
      );
      await page.route("https://js.stripe.com/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: STRIPE_STUB,
        }),
      );
      const bodies: { priceId: string; ui: string }[] = [];
      await page.route("**/api/backend/billing/checkout", async (route) => {
        const body = route.request().postDataJSON() as {
          priceId: string;
          ui: string;
        };
        bodies.push(body);
        await route.fulfill(
          fulfillJson(200, {
            url: "http://localhost:3000/?checkout=complete",
            clientSecret: `cs_test_secret_${body.priceId}`,
          }),
        );
      });

      await page.goto("/upgrade");

      await expect(
        page.getByRole("heading", { level: 2, name: "Start free trial" }),
      ).toBeVisible();
      await expect(
        page.locator('[data-mounted="cs_test_secret_price_indie_month"]'),
      ).toHaveAttribute("aria-label", "Stripe checkout for Indie, monthly");
      await expect(
        page.getByRole("button", { name: "Start free trial" }),
      ).toHaveCount(0);

      await page.getByRole("tab", { name: "Annual" }).click();
      await expect(
        page.locator('[data-mounted="cs_test_secret_price_indie_year"]'),
      ).toHaveCount(1);
      await page.getByRole("button", { name: "Select Ultimate" }).click();
      await expect(
        page.locator('[data-mounted="cs_test_secret_price_ultimate_year"]'),
      ).toHaveCount(1);

      expect(bodies).toEqual([
        { priceId: "price_indie_month", ui: "embedded" },
        { priceId: "price_indie_year", ui: "embedded" },
        { priceId: "price_ultimate_year", ui: "embedded" },
      ]);
    });

    test("keeps the hosted button without a key", async ({ page, context }) => {
      await seedViewer(context, "checkout-pending");
      await seedSession(page);
      await openBilling(page);

      await page.goto("/upgrade");

      await expect(
        page.getByRole("button", { name: "Start free trial" }),
      ).toBeVisible();
      await expect(page.locator("[data-mounted]")).toHaveCount(0);
    });
  });

  test("returning from a trial checkout reconciles once and welcomes the trial", async ({
    page,
    context,
  }) => {
    const renewsAt = new Date(Date.now() + 7 * DAY_MS).toISOString();
    await seedViewer(context, "trialing");
    await seedSession(page);
    await openBilling(page, {
      ...OFFERED_PLAN,
      plan: "indie",
      displayName: "Indie",
      entitled: true,
      subscribed: true,
      hasBillingAccount: true,
      trialOffer: null,
      trialing: true,
      billingInterval: "month",
      trialEndsAt: renewsAt,
      renewsAt,
    });
    let reconciles = 0;
    await page.route("**/api/backend/billing/reconcile", async (route) => {
      reconciles += 1;
      await route.fulfill(
        fulfillJson(200, {
          checked: 1,
          corrected: 1,
          orphanSubscriptions: [],
          unreconciled: [],
        }),
      );
    });

    await page.goto("/?checkout=complete&session_id=cs_test_1");

    await expect(
      page.getByText(
        `Your free trial has started. The first charge is on ${formatDate(renewsAt)}.`,
      ),
    ).toBeVisible();
    await expect(page).toHaveURL("http://localhost:3000/");
    expect(reconciles).toBe(1);
  });
});
