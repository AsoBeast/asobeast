import type { Page, Route } from "@playwright/test";
import { VALID_CONFIRM_TOKEN, VALID_UNSUBSCRIBE_TOKEN } from "./fixtures.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./reporting.mts";

const PASSWORD = "supersecret1";

const refuse = (status: number, message: string) => (route: Route) =>
  route.fulfill(
    fulfillJson(status, {
      statusCode: status,
      error: "Refused",
      message,
      path: new URL(route.request().url()).pathname,
      timestamp: new Date().toISOString(),
    }),
  );

async function signIn(page: Page, refusal: (route: Route) => Promise<void>) {
  await page.route("**/api/backend/auth/login", refusal);
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const formAlert = (page: Page) => page.getByRole("main").getByRole("alert");

test("closed registration sends a visitor to sign in and says why", async ({
  page,
}) => {
  await page.goto("/register");

  await expect(page).toHaveURL(/\/login\?registration=closed$/);
  await expect(
    page.getByText(
      "Registration is closed on this deployment. Ask the owner for an account.",
    ),
  ).toBeVisible();
});

test("a refused sign in announces why and marks both fields", async ({
  page,
}) => {
  await signIn(page, refuse(401, "Invalid email or password"));

  await expect(formAlert(page)).toHaveText("Invalid email or password");
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("a throttled sign in leaves both fields valid", async ({ page }) => {
  await signIn(
    page,
    refuse(
      429,
      "Too many attempts from this address. Try again in 42 seconds.",
    ),
  );

  await expect(
    page.getByText(
      "Too many attempts from this address. Try again in 42 seconds.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await expect(page.getByLabel("Password")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
});

const REFUSED_FORMS = [
  {
    form: "forgot password",
    path: "/forgot-password",
    request: "**/api/backend/auth/password/forgot",
    fill: { Email: "owner@example.com" },
    submit: "Email me a link",
  },
  {
    form: "reset password",
    path: "/reset-password?token=recovery-token",
    request: "**/api/backend/auth/password/reset",
    fill: { "New password": PASSWORD },
    submit: "Set new password",
  },
  {
    form: "invitation",
    path: "/invite?token=invite-token",
    request: "**/api/backend/workspace/invites/accept",
    fill: { Password: PASSWORD },
    submit: "Accept invitation",
  },
] as const;

for (const { form, path, request, fill, submit } of REFUSED_FORMS) {
  test(`the ${form} form announces a refusal`, async ({ page }) => {
    await page.route(request, refuse(400, "This link is no longer valid."));
    await page.goto(path);
    for (const [label, value] of Object.entries(fill)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }

    await page.getByRole("button", { name: submit }).click();

    await expect(formAlert(page)).toHaveText("This link is no longer valid.");
  });
}

test("a signed out page shows a skeleton while it loads", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await seedCookies(context, { e2e_api_latency: "4000" });

  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("main").locator("[data-slot=skeleton]").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Reset your password" }),
  ).toBeVisible({ timeout: 15_000 });
});

test("a dead link sends a signed out visitor back to AsoBeast", async ({
  page,
}) => {
  const response = await page.goto("/invite/expired-link");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to AsoBeast" }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("link", { name: "Back to the dashboard" }),
  ).toHaveCount(0);
});

const ALERT_LINKS = [
  {
    page: "confirm alert",
    path: "/confirm-alert",
    alert: "ea_settings_confirm",
    token: VALID_CONFIRM_TOKEN,
    press: "Confirm email address",
    done: "Alert emails confirmed",
  },
  {
    page: "unsubscribe",
    path: "/unsubscribe",
    alert: "ea_settings_unsubscribe",
    token: VALID_UNSUBSCRIBE_TOKEN,
    press: "Unsubscribe",
    done: "You are unsubscribed",
  },
] as const;

for (const link of ALERT_LINKS) {
  test(`the ${link.page} page offers no settings link to a visitor without an account`, async ({
    page,
  }) => {
    await page.goto(link.path);
    await page.waitForLoadState("networkidle");
    expect(
      await page
        .getByRole("link", { name: "Manage alerts in Settings" })
        .count(),
    ).toBe(0);

    await page.goto(`${link.path}?alert=${link.alert}&token=${link.token}`);
    await page.getByRole("button", { name: link.press }).click();
    await expect(page.getByRole("heading", { name: link.done })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(
      await page.getByRole("link", { name: "Open settings" }).count(),
    ).toBe(0);
  });

  test(`the ${link.page} page offers the settings link to a signed in viewer`, async ({
    page,
  }) => {
    await seedSession(page);

    await page.goto(link.path);
    await expect(
      page.getByRole("link", { name: "Manage alerts in Settings" }),
    ).toHaveAttribute("href", "/settings#email-alerts");

    await page.goto(`${link.path}?alert=${link.alert}&token=${link.token}`);
    await page.getByRole("button", { name: link.press }).click();
    await expect(page.getByRole("heading", { name: link.done })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open settings" }),
    ).toHaveAttribute("href", "/settings#email-alerts");
  });
}
