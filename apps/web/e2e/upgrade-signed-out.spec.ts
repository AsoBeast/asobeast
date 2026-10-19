import type { Page } from "@playwright/test";
import { SESSION_COOKIE, type AuthUser } from "@asobeast/shared";
import { expect, test } from "./reporting.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";

const OWNER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  planExpiresAt: null,
  entitled: true,
  platformOperator: false,
};

const unauthorized = (path: string) =>
  fulfillJson(401, {
    statusCode: 401,
    error: "Unauthorized",
    message: "Sign in to continue.",
    path,
    timestamp: new Date().toISOString(),
  });

function recordUnauthorized(page: Page): string[] {
  const refused: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 401) {
      refused.push(
        `${response.request().method()} ${new URL(response.url()).pathname}`,
      );
    }
  });
  return refused;
}

async function signInFrom(page: Page, path: string) {
  let authenticated = false;
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: false,
        registrationOpen: false,
        setupRequired: false,
        authenticated,
      }),
    ),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, OWNER)),
  );
  await page.route("**/api/backend/auth/login", async (route) => {
    authenticated = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(200, OWNER));
  });

  await page.goto(path);
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a signed out visit to the upgrade page goes to sign in without a refused request", async ({
  page,
}) => {
  const refused = recordUnauthorized(page);

  await page.goto("/upgrade");
  await page.waitForLoadState("networkidle");

  expect(refused).toEqual([]);
  await expect(page).toHaveURL(/\/login\?next=%2Fupgrade$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("a stale session on the upgrade page settles on sign in and asks nothing it would be refused", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE, value: "stale", domain: "localhost", path: "/" },
    ]);
  const refused = recordUnauthorized(page);

  await page.goto("/upgrade");

  await expect(page).toHaveURL(/\/login\?next=%2Fupgrade$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(refused).toEqual([]);
});

test("signing in from an upgrade link returns to the upgrade page", async ({
  page,
}) => {
  await signInFrom(page, "/login?next=%2Fupgrade");

  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(
    page.getByRole("heading", { name: "Keep optimizing without limits" }),
  ).toBeVisible();
});

test("a rejected login destination of the login page itself still lands on the dashboard", async ({
  page,
}) => {
  await signInFrom(page, "/login?next=%2Flogin");

  await expect(page).toHaveURL(/\/$/);
});
