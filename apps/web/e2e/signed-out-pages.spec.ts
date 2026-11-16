import type { Page, Route } from "@playwright/test";
import { fulfillJson } from "./plan-helpers.mts";
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
