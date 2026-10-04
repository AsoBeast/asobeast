import { type Page } from "@playwright/test";
import { type AuthUser } from "@asobeast/shared";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";

const USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: false,
};

const TROUBLESHOOTING_URL =
  "https://docs.asobeast.com/operations/troubleshooting#signing-in-returns-to-the-sign-in-form";

const ACCORDION_TITLE = "Signing in returns to the sign in form";

function notice(page: Page) {
  return page
    .getByRole("alert")
    .filter({ hasText: "did not keep the session cookie" });
}

async function routeStatus(page: Page, authenticated: () => boolean) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: false,
        registrationOpen: true,
        setupRequired: false,
        authenticated: authenticated(),
      }),
    ),
  );
}

async function signIn(page: Page) {
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();
}

function trackAppNavigations(page: Page): string[] {
  const navigations: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.isNavigationRequest() && url.pathname === "/") {
      navigations.push(url.pathname);
    }
  });
  return navigations;
}

test("a sign in whose cookie the browser drops says so instead of reloading the form", async ({
  page,
}) => {
  const navigations = trackAppNavigations(page);
  await routeStatus(page, () => false);
  await page.route("**/api/backend/auth/login", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  await page.goto("/login");
  await signIn(page);

  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toContainText(ACCORDION_TITLE);
  await expect(
    notice(page).getByRole("link", { name: "troubleshooting guide" }),
  ).toHaveAttribute("href", TROUBLESHOOTING_URL);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toHaveValue("owner@example.com");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(navigations).toEqual([]);
});

test("confirming the session reads the public status and nothing a sign in throttle counts", async ({
  page,
}) => {
  const confirmed: string[] = [];
  const logins: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === "/api/backend/auth/me") confirmed.push(pathname);
  });
  await routeStatus(page, () => false);
  await page.route("**/api/backend/auth/login", (route) => {
    logins.push(route.request().url());
    return route.fulfill(fulfillJson(200, USER));
  });

  await page.goto("/login");
  await signIn(page);
  await expect(notice(page)).toBeVisible();

  expect(logins).toHaveLength(1);
  expect(confirmed).toEqual([]);
});

test("a second attempt after the browser is fixed signs in and clears the notice", async ({
  page,
}) => {
  let attempts = 0;
  let kept = false;
  await routeStatus(page, () => kept);
  await page.route("**/api/backend/auth/login", async (route) => {
    attempts += 1;
    if (attempts === 2) {
      kept = true;
      await seedSession(page);
    }
    await route.fulfill(fulfillJson(200, USER));
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  await page.goto("/login");
  await signIn(page);
  await expect(notice(page)).toBeVisible();

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(attempts).toBe(2);
});

test("a kept session still lands on the requested page", async ({ page }) => {
  let kept = false;
  await routeStatus(page, () => kept);
  await page.route("**/api/backend/auth/login", async (route) => {
    kept = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(200, USER));
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  await page.goto("/login?next=%2Fsettings");
  await signIn(page);

  await expect(page).toHaveURL(/\/settings$/);
  await expect(notice(page)).toHaveCount(0);
});

test("an unanswered session check does not stop a sign in that worked", async ({
  page,
}) => {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(500, {
        statusCode: 500,
        error: "Internal Server Error",
        message: "Internal server error",
        path: "/auth/status",
        timestamp: new Date().toISOString(),
      }),
    ),
  );
  await page.route("**/api/backend/auth/login", async (route) => {
    await seedSession(page);
    await route.fulfill(fulfillJson(200, USER));
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  await page.goto("/login");
  await signIn(page);

  await expect(page).toHaveURL(/\/$/);
});

test("a registration whose cookie the browser drops says the account exists", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e_setup_required",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await routeStatus(page, () => false);
  await page.route("**/api/backend/auth/register", (route) =>
    route.fulfill(fulfillJson(201, USER)),
  );

  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(notice(page)).toContainText("Your account was created.");
  await expect(page).toHaveURL(/\/register$/);
});

test("an accepted invitation whose cookie the browser drops says the invitation was used", async ({
  page,
}) => {
  await routeStatus(page, () => false);
  await page.route("**/api/backend/workspace/invites/accept", (route) =>
    route.fulfill(fulfillJson(201, USER)),
  );

  await page.goto("/invite?token=invitation-token-value");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(notice(page)).toContainText("You joined the workspace.");
  await expect(page).toHaveURL(/\/invite\?/);
});

test("a confirmed email whose cookie the browser drops does not call the link spent", async ({
  page,
}) => {
  await routeStatus(page, () => false);
  await page.route("**/api/backend/auth/verify", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  await page.goto("/verify?token=confirmation-token-value");
  await page.getByRole("button", { name: "Confirm my email" }).click();

  await expect(notice(page)).toContainText("Your email is confirmed.");
  await expect(page.getByText("no longer valid")).toHaveCount(0);
  await expect(page).toHaveURL(/\/verify\?/);
});
