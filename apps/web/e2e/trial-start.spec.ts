import { formatDate } from "../src/lib/format";
import { type Page } from "@playwright/test";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import {
  CATALOG,
  DAY_MS,
  DECLINED_PLAN,
  OFFERED_PLAN,
  TRIALING_PLAN,
  openBilling,
  openRegistration,
} from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";
import { summaryFromCatalog } from "../src/lib/order-summary";
import { paywallFaq } from "../src/lib/paywall-faq";
import { trustLines } from "../src/lib/plan-choice";

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
    for (const line of trustLines({ days: 7 }, new Date())) {
      await expect(page.getByText(line, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("tab", { name: "Monthly" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Annual Save 17%" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Indie, $10 per month" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Ultimate, $99 per month" }),
    ).toHaveAttribute("aria-pressed", "false");
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
      page.getByRole("button", { name: "Ultimate, $99 per month" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Indie, $10 per month" }).click();

    await expect(page).toHaveURL(/\/upgrade\?plan=indie$/);
    await expect(
      page.getByRole("button", { name: "Indie, $10 per month" }),
    ).toHaveAttribute("aria-pressed", "true");
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
        fulfillJson(200, { url: "https://checkout.stripe.test/session" }),
      );
    });
    await page.route("https://checkout.stripe.test/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );

    await page.goto("/upgrade");
    await page.getByRole("tab", { name: "Annual" }).click();
    await page.getByRole("button", { name: "Start free trial" }).click();

    await expect
      .poll(() => requested)
      .toEqual({ priceId: "price_indie_year", ui: "hosted" });
    await expect(page).toHaveURL("https://checkout.stripe.test/session");
  });

  test("confirming lands an account without a plan on the wall", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
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

  test("lays the payment out left of the plans on a wide screen", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const plans = page.getByRole("heading", {
      level: 2,
      name: "Choose a plan",
    });
    const payment = page.getByRole("heading", { level: 2, name: "Payment" });
    await expect(plans).toBeVisible();
    const [plansBox, paymentBox] = await Promise.all([
      plans.boundingBox(),
      payment.boundingBox(),
    ]);
    expect(paymentBox!.x).toBeLessThan(plansBox!.x);
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(headings.indexOf("Choose a plan")).toBeLessThan(
      headings.indexOf("Payment"),
    );
  });

  test("puts the plans above the payment on a phone without scrolling sideways", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const plans = page.getByRole("heading", {
      level: 2,
      name: "Choose a plan",
    });
    const payment = page.getByRole("heading", { level: 2, name: "Payment" });
    await expect(plans).toBeVisible();
    const [plansBox, paymentBox] = await Promise.all([
      plans.boundingBox(),
      payment.boundingBox(),
    ]);
    expect(plansBox!.y).toBeLessThan(paymentBox!.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("never asks for the confirmation on the wall", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send a new link" }),
    ).toHaveCount(0);
    await expect(page.getByText("confirmation link")).toHaveCount(0);
  });

  test("writes its own order summary and follows the interval", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    const monthly = summaryFromCatalog(
      "indie",
      "month",
      { days: 7 },
      new Date(),
    );

    await page.goto("/upgrade");

    const summary = page
      .getByRole("heading", { name: "Order summary" })
      .locator("../..");
    await expect(summary).toContainText("Indie");
    await expect(summary).toContainText("Due today");
    await expect(summary).toContainText("$0.00");
    await expect(summary).toContainText(monthly.thenLine!);

    await page.getByRole("tab", { name: /^Annual/ }).click();

    await expect(summary).toContainText("$100.00");
    await expect(summary).toContainText("Annual");
  });

  test("answers the questions a new customer asks, each on a click", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    const items = paywallFaq({ days: 7 }, "$10 per month", new Date());

    await page.goto("/upgrade");

    const questions = page
      .getByRole("region", { name: "Questions" })
      .getByRole("button");
    await expect(questions).toHaveCount(7);
    for (const [index, item] of items.entries()) {
      await questions.nth(index).click();
      await expect(page.getByText(item.answer)).toBeVisible();
    }
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
        page.getByRole("heading", { level: 2, name: "Payment" }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Your trial" }),
      ).toContainText("Your 7 day trial is 100% free");
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
      await page.getByRole("button", { name: /^Ultimate,/ }).click();
      await expect(
        page.locator('[data-mounted="cs_test_secret_price_ultimate_year"]'),
      ).toHaveCount(1);

      expect(bodies).toEqual([
        { priceId: "price_indie_month", ui: "embedded" },
        { priceId: "price_indie_year", ui: "embedded" },
        { priceId: "price_ultimate_year", ui: "embedded" },
      ]);
    });

    test("opens no checkout session for a plan left before stripe loaded", async ({
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
      let releaseStripe: () => void = () => {};
      const stripeHeld = new Promise<void>((resolve) => {
        releaseStripe = resolve;
      });
      await page.route("https://js.stripe.com/**", async (route) => {
        await stripeHeld;
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: STRIPE_STUB,
        });
      });
      const priceIds: string[] = [];
      await page.route("**/api/backend/billing/checkout", async (route) => {
        const { priceId } = route.request().postDataJSON() as {
          priceId: string;
        };
        priceIds.push(priceId);
        await route.fulfill(
          fulfillJson(200, {
            url: "http://localhost:3000/?checkout=complete",
            clientSecret: `cs_test_secret_${priceId}`,
          }),
        );
      });

      await page.goto("/upgrade");
      await page.getByRole("tab", { name: "Annual" }).click();
      await page.getByRole("button", { name: /^Ultimate,/ }).click();
      await expect(page).toHaveURL(/\/upgrade\?plan=ultimate$/);
      releaseStripe();

      await expect(
        page.locator('[data-mounted="cs_test_secret_price_ultimate_year"]'),
      ).toHaveCount(1);
      expect(priceIds).toEqual(["price_ultimate_year"]);
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

test.describe("a card backed trial", () => {
  test.beforeEach(async ({ page, context }) => {
    await seedViewer(context, "trialing");
    await seedSession(page);
  });

  test("names its end and its price on every page", async ({ page }) => {
    await openBilling(page, TRIALING_PLAN);

    await page.goto("/");

    await expect(
      page.getByText("Trial ends in 5 days, then Indie at $10 per month."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage billing" }),
    ).toHaveAttribute("href", "/settings");
  });

  test("says a cancelled trial charges nothing", async ({ page }) => {
    await openBilling(page, { ...TRIALING_PLAN, cancelAtPeriodEnd: true });

    await page.goto("/");

    await expect(
      page.getByText(
        `Trial ends on ${formatDate(TRIALING_PLAN.trialEndsAt)}. Nothing will be charged.`,
      ),
    ).toBeVisible();
  });

  test("tells settings the trial allowance and the charge", async ({
    page,
  }) => {
    await openBilling(page, TRIALING_PLAN);

    await page.goto("/settings");

    await expect(
      page.getByText(
        `Trial until ${formatDate(TRIALING_PLAN.trialEndsAt)}, then $10 per month.`,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("The trial allowance applies until the first charge.", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("sends a declined first charge to the portal", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "customer");
    await openBilling(page, DECLINED_PLAN);

    await page.goto("/settings");

    await expect(
      page.getByText(
        "Your trial ended, but the card was declined. Update it in the billing portal to start your plan.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Manage billing" }),
    ).toBeVisible();
  });
});
