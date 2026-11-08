import { expect, test } from "./reporting.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { OFFERED_PLAN, openBilling, openRegistration } from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";
import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from "../src/lib/legal";
import { TRIAL_REFUSED } from "../src/lib/plan-choice";

const CONSENT = /By creating an account you agree to the/;

test.use({ timezoneId: "UTC" });

test.describe("the terms on a billing instance", () => {
  test("sign up names and links the terms and the age", async ({ page }) => {
    await openRegistration(page);
    await openBilling(page);

    await page.goto("/register");

    const consent = page.getByText(CONSENT);
    await expect(consent).toContainText("and confirm you are 18 or over.");
    await expect(
      consent.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", TERMS_OF_SERVICE_URL);
    await expect(
      consent.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", PRIVACY_POLICY_URL);
  });

  test("an invitation names the terms too", async ({ page }) => {
    await openBilling(page);

    await page.goto("/invite?token=invitation-token-value");

    await expect(page.getByText(CONSENT)).toBeVisible();
  });

  test("the sidebar and the wall link both pages", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page);

    await page.goto("/upgrade");
    await expect(
      page.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", TERMS_OF_SERVICE_URL);
    await expect(
      page.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", PRIVACY_POLICY_URL);
  });

  test("the sidebar links both pages for a signed in viewer", async ({
    page,
  }) => {
    await seedSession(page);
    await page
      .context()
      .addCookies([
        { name: "e2e_billing", value: "1", domain: "localhost", path: "/" },
      ]);

    await page.goto("/settings");

    const sidebar = page.getByRole("navigation", { name: "Main" });
    await expect(
      sidebar.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", TERMS_OF_SERVICE_URL);
    await expect(
      sidebar.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", PRIVACY_POLICY_URL);
  });

  test("returning from a refused trial lands on the wall with the reason", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page, {
      ...OFFERED_PLAN,
      trialOffer: null,
      trialRefused: true,
    });
    await page.route("**/api/backend/billing/reconcile", async (route) => {
      await page.waitForTimeout(1_500);
      await route.fulfill(
        fulfillJson(200, {
          checked: 1,
          corrected: 0,
          orphanSubscriptions: [],
          unreconciled: [],
        }),
      );
    });

    await page.goto("/?checkout=complete&session_id=cs_test_refused");

    await expect(page).toHaveURL(/\/upgrade$/);
    await expect(page.getByText(TRIAL_REFUSED)).toBeVisible();
  });

  test("a refused trial is told why and offered a normal checkout", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "checkout-pending");
    await seedSession(page);
    await openBilling(page, {
      ...OFFERED_PLAN,
      trialOffer: null,
      trialRefused: true,
    });

    await page.goto("/upgrade");

    await expect(page.getByText(TRIAL_REFUSED)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /free trial/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Order summary" }),
    ).toContainText(
      "Then $10 per month plus any VAT or sales tax, renewing monthly until you cancel.",
    );
  });
});

test.describe("without billing", () => {
  test("sign up and the sidebar carry no legal links", async ({ page }) => {
    await openRegistration(page);

    await page.goto("/register");
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
    await expect(page.getByText(CONSENT)).toHaveCount(0);

    await seedSession(page);
    await page.goto("/settings");
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", {
        name: "Documentation",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Terms of Service" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveCount(0);
  });

  test("an invitation carries no legal links", async ({ page }) => {
    await page.goto("/invite?token=invitation-token-value");

    await expect(
      page.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await expect(page.getByText(CONSENT)).toHaveCount(0);
  });
});
