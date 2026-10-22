import { formatDate } from "../src/lib/format";
import { type Page } from "@playwright/test";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import { DAY_MS, openBilling, openRegistration } from "./trial-plans.mts";
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
});
