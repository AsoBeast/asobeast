import { type Page } from "@playwright/test";
import { seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import { openBilling, openRegistration } from "./trial-plans.mts";
import { seedViewer, type Viewer } from "./viewer.mts";

const CONFIRM_SENTENCE =
  "Thank you for registering. We sent a link to owner@example.com. Open it to continue to your free trial.";

async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();
}

async function openAs(page: Page, viewer: Viewer) {
  await seedViewer(page.context(), viewer);
  await seedSession(page);
  await openBilling(page);
}

test.describe("the confirmation page", () => {
  test("registration lands on a page that asks for the link and nothing else", async ({
    page,
  }) => {
    await seedViewer(page.context(), "checkout-pending-unconfirmed");
    await openRegistration(page);
    await openBilling(page);
    let stripeRequests = 0;
    await page.route("https://js.stripe.com/**", async (route) => {
      stripeRequests += 1;
      await route.abort();
    });

    await register(page);

    await expect(page).toHaveURL(/\/confirm-email$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Confirm your email" }),
    ).toBeVisible();
    await expect(page.getByText(CONFIRM_SENTENCE)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send a new link" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Indie/ })).toHaveCount(0);
    expect(stripeRequests).toBe(0);
  });

  test("sends one new link and says so", async ({ page }) => {
    await openAs(page, "checkout-pending-unconfirmed");
    let resends = 0;
    await page.route("**/api/backend/auth/verify/resend", async (route) => {
      resends += 1;
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/confirm-email");
    await page.getByRole("button", { name: "Send a new link" }).click();

    await expect(
      page.getByRole("button", { name: "New link sent" }),
    ).toBeVisible();
    expect(resends).toBe(1);
  });

  for (const [viewer, destination] of [
    ["checkout-pending", /\/upgrade$/],
    ["customer", /localhost:3000\/$/],
    ["member", /localhost:3000\/$/],
  ] as const) {
    test(`sends ${viewer} away from the confirmation page`, async ({
      page,
    }) => {
      await openAs(page, viewer);

      await page.goto("/confirm-email");

      await expect(page).toHaveURL(destination);
    });
  }

  test("the wall sends an unconfirmed owner to the confirmation page", async ({
    page,
  }) => {
    await openAs(page, "checkout-pending-unconfirmed");

    await page.goto("/upgrade");

    await expect(page).toHaveURL(/\/confirm-email$/);
  });

  test("signs out from the confirmation page", async ({ page }) => {
    await openAs(page, "checkout-pending-unconfirmed");
    let signOuts = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/backend/auth/logout")
      ) {
        signOuts += 1;
      }
    });

    await page.goto("/confirm-email");
    await page.getByRole("button", { name: "Sign out" }).first().click();

    await expect(page).toHaveURL(/\/login$/);
    expect(signOuts).toBe(1);
  });

  test("the link lands an unconfirmed owner back on the confirmation page", async ({
    page,
  }) => {
    await seedViewer(page.context(), "checkout-pending-unconfirmed");
    await openBilling(page);

    await page.goto("/verify?token=abc");
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await expect(page).toHaveURL(/\/confirm-email$/);
  });

  test("leaves for the wall once the address is confirmed in another tab", async ({
    page,
  }) => {
    await openAs(page, "checkout-pending-unconfirmed");
    const hydrated = page.waitForResponse("**/api/backend/auth/me");
    await page.goto("/confirm-email");
    await hydrated;
    await seedViewer(page.context(), "checkout-pending");

    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );

    await expect(page).toHaveURL(/\/upgrade$/);
  });
});
