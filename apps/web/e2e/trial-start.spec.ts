import { formatDate } from "../src/lib/format";
import { type Locator, type Page } from "@playwright/test";
import { openEmbedded, STRIPE_STUB } from "./embedded-checkout.mts";
import { holdRequest } from "./held-request.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { layoutBox } from "./layout-box.mts";
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
import { trialBarParts, trustLines } from "../src/lib/plan-choice";

const TRIAL_BUTTON = "Pay $0 today and start your free trial";

test.use({ timezoneId: "UTC" });

const utcClock = (now = new Date()) => ({ now, timeZone: "UTC" });

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
        `Pay $0 today. Your trial ends on ${endsOn}, then the plan you choose is charged, plus any VAT or sales tax, and renews until you cancel. Cancel any time from settings.`,
      ),
    ).toBeVisible();
    for (const line of trustLines({ days: 7 }, utcClock())) {
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
      page.getByRole("button", { name: TRIAL_BUTTON }),
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
    await page.getByRole("button", { name: TRIAL_BUTTON }).click();

    await expect
      .poll(() => requested)
      .toEqual({ priceId: "price_indie_year", ui: "hosted", theme: "light" });
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
      layoutBox(plans),
      layoutBox(payment),
    ]);
    expect(paymentBox.x).toBeLessThan(plansBox.x);
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(headings.indexOf("Choose a plan")).toBeLessThan(
      headings.indexOf("Payment"),
    );
    expect(headings.indexOf("Payment")).toBeLessThan(
      headings.indexOf("Questions"),
    );
    const panelBox = await layoutBox(
      page.getByRole("region", { name: "Payment" }),
    );
    const questionsBox = await layoutBox(
      page.getByRole("heading", { level: 2, name: "Questions" }),
    );
    expect(questionsBox.y).toBeGreaterThan(panelBox.y + panelBox.height);
    expect(Math.round(questionsBox.x)).toBe(Math.round(panelBox.x));
    const questions = page
      .getByRole("region", { name: "Questions" })
      .getByRole("button");
    const [first, second] = await Promise.all([
      layoutBox(questions.nth(0)),
      layoutBox(questions.nth(1)),
    ]);
    expect(Math.round(first.y)).toBe(Math.round(second.y));
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
      layoutBox(plans),
      layoutBox(payment),
    ]);
    expect(plansBox.y).toBeLessThan(paymentBox.y);
    const questionsBox = await layoutBox(
      page.getByRole("heading", { level: 2, name: "Questions" }),
    );
    expect(paymentBox.y).toBeLessThan(questionsBox.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const cards = page
      .getByRole("group", { name: "Plans" })
      .getByRole("button");
    const [indie, ultimate] = await Promise.all([
      layoutBox(cards.nth(0)),
      layoutBox(cards.nth(1)),
    ]);
    expect(Math.round(indie.y)).toBe(Math.round(ultimate.y));
    const questions = page
      .getByRole("region", { name: "Questions" })
      .getByRole("button");
    const [first, second] = await Promise.all([
      layoutBox(questions.nth(0)),
      layoutBox(questions.nth(1)),
    ]);
    expect(first.y).toBeLessThan(second.y);
  });

  test("promises no secure payment when checkout is not configured", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    await page.route("**/api/backend/billing/catalog", (route) =>
      route.fulfill(fulfillJson(200, { enabled: false, prices: [] })),
    );

    await page.goto("/upgrade");

    await expect(
      page.getByText("Checkout is not configured on this instance.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Secure payments processed by Stripe."),
    ).toHaveCount(0);
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

  test("shows the sign up as three steps with the plan step current", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const steps = page.getByRole("list", { name: "Sign up steps" });
    await expect(steps.getByRole("listitem")).toHaveText([
      /Account created/,
      /Email confirmed/,
      /Choose a plan/,
    ]);
    await expect(steps.locator("[aria-current='step']")).toHaveText(
      /Choose a plan/,
    );
    await expect(
      steps.getByRole("listitem").nth(0).locator("svg"),
    ).toBeVisible();
    const [stepsBox, headingBox] = await Promise.all([
      layoutBox(steps),
      layoutBox(page.getByRole("heading", { level: 1 })),
    ]);
    expect(stepsBox.y).toBeLessThan(headingBox.y);
  });

  test("leaves the session check when the session status cannot be read", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    await page.route("**/api/backend/auth/status", (route) =>
      route.fulfill({ status: 503 }),
    );

    await page.goto("/upgrade");

    await expect(
      page.getByRole("status", { name: "Checking your session" }),
    ).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("keeps the current plan badge inside its card on a narrow phone", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await seedViewer(context, "trialing");
    await seedSession(page);
    await openBilling(page, {
      ...TRIALING_PLAN,
      plan: "ultimate",
      displayName: "Ultimate",
      trialing: false,
      trialEndsAt: null,
    });

    await page.goto("/upgrade?plan=ultimate");

    const card = page
      .getByRole("group", { name: "Plans" })
      .getByRole("button")
      .nth(1);
    const badge = card.getByText("Current", { exact: true });
    await expect(badge).toBeVisible();
    const [cardBox, badgeBox] = await Promise.all([
      layoutBox(card),
      layoutBox(badge),
    ]);
    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width,
    );
  });

  test("shows no steps to an owner who owes none", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "trialing");
    await seedSession(page);
    await openBilling(page, TRIALING_PLAN);

    await page.goto("/upgrade");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("list", { name: "Sign up steps" })).toHaveCount(
      0,
    );
  });

  test("sets the heading in the hero size on a laptop and the display size on a phone", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    const heading = page.getByRole("heading", { level: 1 });
    const fontSize = () =>
      heading.evaluate((h1) => getComputedStyle(h1).fontSize);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/upgrade");
    await expect(heading).toBeVisible();
    expect(await fontSize()).toBe("36px");

    await page.setViewportSize({ width: 375, height: 812 });
    expect(await fontSize()).toBe("24px");
  });

  test("marks each trust line with a check", async ({ page, context }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    const now = new Date();
    await page.clock.setFixedTime(now);
    const lines = trustLines({ days: 7 }, utcClock(now));

    await page.goto("/upgrade");

    const row = page.getByRole("list", { name: "Why the trial is safe" });
    await expect(row.getByRole("listitem")).toHaveText(lines);
    await expect(row.locator("svg")).toHaveCount(3);
  });

  test("holds the wall to the checkout width on a wide screen", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const wall = page
      .getByRole("heading", { level: 1 })
      .locator("xpath=ancestor::div[contains(@class,'page-checkout')]");
    const box = await layoutBox(wall);
    expect(box.width).toBeLessThanOrEqual(1216);
    expect(Math.abs(box.x - (1920 - box.width) / 2)).toBeLessThanOrEqual(2);
  });

  test("shows each plan's price and the limits that tell them apart", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const indie = page.getByRole("button", { name: "Indie, $10 per month" });
    const ultimate = page.getByRole("button", {
      name: "Ultimate, $99 per month",
    });
    await expect(indie).toHaveAttribute("aria-pressed", "true");
    await expect(indie).toContainText("5 apps");
    await expect(indie).toContainText("1,000 keyword markets");
    await expect(ultimate).toContainText("50 apps");
    await expect(indie).toHaveAccessibleDescription(
      "5 apps 1,000 keyword markets",
    );
    await expect(ultimate).toHaveAccessibleDescription(
      "50 apps 10,000 keyword markets",
    );
    const background = (button: Locator) =>
      button.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(await background(indie)).not.toBe(await background(ultimate));
    const priceSize = await indie
      .getByText("$10", { exact: true })
      .evaluate((node) => getComputedStyle(node).fontSize);
    expect(priceSize).toBe("36px");

    await ultimate.click();

    await expect(ultimate).toHaveAttribute("aria-pressed", "true");
    expect(await background(ultimate)).not.toBe(await background(indie));
    await expect(
      page.getByRole("heading", { name: "What Ultimate includes" }),
    ).toBeVisible();
  });

  test("names the saving inside the annual option", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const annual = page.getByRole("tab", { name: /^Annual/ });
    const badge = annual.getByText("Save 17%");
    await expect(badge).toBeVisible();
    const color = (locator: Locator) =>
      locator.evaluate((node) => getComputedStyle(node).color);
    expect(await color(badge)).not.toBe(
      await color(annual.getByText("Annual", { exact: true })),
    );
    await annual.click();
    await expect(
      page.getByRole("button", { name: "Indie, $100 per year" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("frames the payment in one raised panel", async ({ page, context }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");

    const panel = page.getByRole("region", { name: "Payment" });
    const styles = await panel.evaluate((node) => {
      const computed = getComputedStyle(node);
      return {
        border: computed.borderTopWidth,
        background: computed.backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(styles.border).toBe("1px");
    expect(styles.background).not.toBe(styles.page);
    await expect(
      panel.getByRole("region", { name: "Order summary" }),
    ).toBeVisible();
  });

  test("draws the strip with the promise in the foreground and a tall button", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    const now = new Date();
    await page.clock.setFixedTime(now);
    const parts = trialBarParts({ days: 7 }, utcClock(now));

    await page.goto("/upgrade");

    const strip = page.getByRole("region", { name: "Your trial" });
    const color = (locator: Locator) =>
      locator.evaluate((node) => getComputedStyle(node).color);
    const heading = await color(page.getByRole("heading", { level: 1 }));
    expect(await color(strip.getByText(parts.free, { exact: true }))).toBe(
      heading,
    );
    expect(await color(strip.getByText(parts.endsOn, { exact: true }))).toBe(
      heading,
    );
    expect(
      await color(strip.getByText(parts.before.trim(), { exact: true })),
    ).not.toBe(heading);
    const button = strip.getByRole("button", { name: TRIAL_BUTTON });
    expect((await layoutBox(button)).height).toBe(44);
  });

  test("keeps the checkout button at the right edge without a trial", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page, { ...OFFERED_PLAN, trialOffer: null });

    await page.goto("/upgrade");

    const strip = page.getByRole("region", { name: "Checkout" });
    const button = strip.getByRole("button", { name: "Choose Indie" });
    const panel = page.getByRole("region", { name: "Payment" });
    const plans = page.getByRole("group", { name: "Plans" });
    await expect(button).toBeVisible();
    const [buttonBox, panelBox, plansBox] = await Promise.all([
      layoutBox(button),
      layoutBox(panel),
      layoutBox(plans),
    ]);
    expect(buttonBox.x).toBeGreaterThan(panelBox.x + panelBox.width);
    expect(
      Math.abs(buttonBox.x + buttonBox.width - (plansBox.x + plansBox.width)),
    ).toBeLessThanOrEqual(2);
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
      utcClock(),
    );

    await page.goto("/upgrade");

    const summary = page.getByRole("region", { name: "Order summary" });
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
    const items = paywallFaq(
      { days: 7 },
      "$10 per month plus any VAT or sales tax, renewing monthly until you cancel",
      utcClock(),
    );

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
        page.getByRole("button", { name: TRIAL_BUTTON }),
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
        { priceId: "price_indie_month", ui: "embedded", theme: "light" },
        { priceId: "price_indie_year", ui: "embedded", theme: "light" },
        { priceId: "price_ultimate_year", ui: "embedded", theme: "light" },
      ]);
    });

    test("opens one session at a time while plans and intervals change quickly", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await openEmbedded(page);
      await page.unroute("**/api/backend/billing/checkout");
      const answers: number[] = [];
      let opening = false;
      await page.route("**/api/backend/billing/checkout", async (route) => {
        const { priceId } = route.request().postDataJSON() as {
          priceId: string;
        };
        if (opening) {
          answers.push(409);
          await route.fulfill(
            fulfillJson(409, {
              statusCode: 409,
              error: "Conflict",
              message:
                "A checkout is already being opened for this workspace. Try again in a couple of minutes.",
              path: "/billing/checkout",
              timestamp: new Date().toISOString(),
            }),
          );
          return;
        }
        opening = true;
        await new Promise((resolve) => setTimeout(resolve, 400));
        opening = false;
        answers.push(200);
        await route.fulfill(
          fulfillJson(200, {
            url: "http://localhost:3000/?checkout=complete",
            clientSecret: `cs_${priceId}_${answers.length}`,
          }),
        );
      });

      await page.goto("/upgrade");
      await expect(
        page.locator('[data-mounted="cs_price_indie_month_1"]'),
      ).toHaveCount(1);
      await page.getByRole("button", { name: /^Ultimate,/ }).click();
      await page.getByRole("tab", { name: "Annual" }).click();
      await page.getByRole("tab", { name: "Monthly" }).click();
      await page.getByRole("button", { name: /^Indie,/ }).click();

      await expect(page.locator("[data-mounted]")).toHaveAttribute(
        "data-mounted",
        /^cs_price_indie_month_\d+$/,
      );
      await expect(page.locator("[data-stripe-error]")).toHaveCount(0);
      await expect(
        page.getByText("A checkout is already being opened"),
      ).toHaveCount(0);
      expect(answers).not.toContain(409);
      expect(pageErrors).toEqual([]);
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

    test("opens no checkout before the account plan answers", async ({
      page,
    }) => {
      const bodies = await openEmbedded(page);
      const plan = await holdRequest(
        page,
        /\/api\/backend\/auth\/plan$/,
        "GET",
        (route) => route.fulfill(fulfillJson(200, OFFERED_PLAN)),
      );
      const catalogRead = page.waitForResponse(
        "**/api/backend/billing/catalog",
      );

      await page.goto("/upgrade");
      await catalogRead;
      await page.waitForTimeout(1_000);

      expect(bodies).toEqual([]);
      await expect(
        page.getByRole("status", { name: "Checking your session" }),
      ).toBeVisible();
      plan.release();
      await expect(page.locator("[data-mounted]")).toHaveCount(1);
      expect(bodies).toHaveLength(1);
    });

    test("keeps the plans in view while the card form scrolls", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 700 });
      await openEmbedded(page);

      await page.goto("/upgrade");
      await expect(page.locator("[data-mounted]")).toHaveCount(1);
      await page.evaluate(() => window.scrollTo(0, 600));

      const plans = await layoutBox(
        page.getByRole("heading", { level: 2, name: "Choose a plan" }),
      );
      const payment = await layoutBox(
        page.getByRole("heading", { level: 2, name: "Payment" }),
      );
      expect(plans.y).toBeGreaterThanOrEqual(0);
      expect(plans.y).toBeLessThanOrEqual(48);
      expect(payment.y).toBeLessThan(0);

      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );

      const features = await layoutBox(
        page.getByRole("region", { name: "What Indie includes" }),
      );
      const questions = await layoutBox(
        page.getByRole("heading", { level: 2, name: "Questions" }),
      );
      expect(features.y + features.height).toBeLessThanOrEqual(questions.y);
    });

    test.describe("in the light theme", () => {
      test.use({ colorScheme: "light" });

      test("brands the session light and remounts it dark on a toggle", async ({
        page,
      }) => {
        const bodies = await openEmbedded(page);

        await page.goto("/upgrade");
        await expect(
          page.locator('[data-mounted="cs_price_indie_month_light_1"]'),
        ).toHaveCount(1);

        const toggle = page.getByRole("button", { name: /Switch theme/ });
        await toggle.click();
        await expect(toggle).toHaveAccessibleName("Theme: light. Switch theme");
        await toggle.click();

        await expect(
          page.locator('[data-mounted="cs_price_indie_month_dark_2"]'),
        ).toHaveCount(1);
        expect(bodies.map((body) => body.theme)).toEqual(["light", "dark"]);
      });
    });

    test.describe("in the dark theme", () => {
      test.use({ colorScheme: "dark" });

      test("keeps the dark brand across a plan change", async ({ page }) => {
        const bodies = await openEmbedded(page);

        await page.goto("/upgrade");
        await expect(
          page.locator('[data-mounted="cs_price_indie_month_dark_1"]'),
        ).toHaveCount(1);
        await page.getByRole("button", { name: /^Ultimate,/ }).click();

        await expect(
          page.locator('[data-mounted="cs_price_ultimate_month_dark_2"]'),
        ).toHaveCount(1);
        expect(bodies.map((body) => body.theme)).toEqual(["dark", "dark"]);
      });

      test("retries a refused session with the same theme", async ({
        page,
      }) => {
        const bodies: string[] = [];
        await openEmbedded(page);
        await page.unroute("**/api/backend/billing/checkout");
        await page.route("**/api/backend/billing/checkout", async (route) => {
          const { theme } = route.request().postDataJSON() as {
            theme: string;
          };
          bodies.push(theme);
          if (bodies.length === 1) {
            await route.fulfill(
              fulfillJson(409, {
                statusCode: 409,
                error: "Conflict",
                message: "A checkout is already being opened. Try again.",
                path: "/billing/checkout",
                timestamp: new Date().toISOString(),
              }),
            );
            return;
          }
          await route.fulfill(
            fulfillJson(200, {
              url: "http://localhost:3000/?checkout=complete",
              clientSecret: "cs_retried",
            }),
          );
        });

        await page.goto("/upgrade");
        await expect(
          page.getByText("A checkout is already being opened. Try again."),
        ).toBeVisible();
        await page.getByRole("button", { name: "Try again" }).click();

        await expect(page.locator('[data-mounted="cs_retried"]')).toHaveCount(
          1,
        );
        expect(bodies).toEqual(["dark", "dark"]);
      });
    });

    test("lets the next plan open after a checkout request stalls", async ({
      page,
    }) => {
      await page.clock.install();
      const bodies = await openEmbedded(page);
      await page.unroute("**/api/backend/billing/checkout");
      await page.route("**/api/backend/billing/checkout", async (route) => {
        const body = route.request().postDataJSON() as { priceId: string };
        bodies.push(body as (typeof bodies)[number]);
        if (bodies.length === 1) return;
        await route.fulfill(
          fulfillJson(200, {
            url: "http://localhost:3000/?checkout=complete",
            clientSecret: `cs_${body.priceId}`,
          }),
        );
      });

      await page.goto("/upgrade");
      await expect.poll(() => bodies.length).toBe(1);
      await page.getByRole("button", { name: /^Ultimate,/ }).click();
      await page.clock.fastForward(36_000);

      await expect(
        page.locator('[data-mounted="cs_price_ultimate_month"]'),
      ).toHaveCount(1);
      expect(bodies.map((body) => body.priceId)).toEqual([
        "price_indie_month",
        "price_ultimate_month",
      ]);
    });

    test("keeps the hosted button without a key", async ({ page, context }) => {
      await seedViewer(context, "checkout-pending");
      await seedSession(page);
      await openBilling(page);

      await page.goto("/upgrade");

      await expect(
        page.getByRole("button", { name: TRIAL_BUTTON }),
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

test.describe("the trial end in a time zone ahead of UTC", () => {
  test.use({ timezoneId: "Europe/Warsaw" });

  test("names the first charge on the day checkout names, late in the UTC day", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);
    await page.clock.setFixedTime(new Date("2026-11-06T23:30:00.000Z"));

    await page.goto("/upgrade");

    await expect(
      page.getByRole("region", { name: "Order summary" }),
    ).toContainText("From Nov 14, 2026: $10 per month");
    await expect(
      page.getByRole("region", { name: "Your trial" }),
    ).toContainText("ending Nov 14, 2026");
    await expect(
      page.getByRole("list", { name: "Why the trial is safe" }),
    ).toContainText("cancel before Nov 14, 2026");
    const questions = page.getByRole("region", { name: "Questions" });
    await questions
      .getByRole("button", { name: "Will I be charged today?" })
      .click();
    await expect(questions).toContainText("From Nov 14, 2026: $10 per month");
    await expect(page.getByText(/Nov 13, 2026/)).toHaveCount(0);
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
