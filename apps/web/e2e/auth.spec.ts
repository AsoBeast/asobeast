import { type Page } from "@playwright/test";
import { expect, test } from "./reporting.mts";
import {
  PLAN_LIMITS,
  SESSION_COOKIE,
  UPGRADE_PATH,
  type AccountPlan,
  type ApiTokenItem,
  type AuthStatus,
  type AuthUser,
} from "@asobeast/shared";

const TRIAL_USER: AuthUser = {
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

function fulfillJson(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function routeStatus(page: Page, status: AuthStatus) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(fulfillJson(200, status)),
  );
}

async function seedSession(page: Page) {
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE, value: "e2e", domain: "localhost", path: "/" },
    ]);
}

test("guarded pages redirect to login when unauthenticated", async ({
  page,
}) => {
  await routeStatus(page, {
    billing: false,
    registrationOpen: false,
    setupRequired: false,
    authenticated: false,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("guarded redirects preserve the requested query string", async ({
  page,
}) => {
  await page.goto("/apps?country=us");

  await expect(page).toHaveURL(/\/login\?next=%2Fapps%3Fcountry%3Dus$/);
});

test("the mock auth endpoint rejects requests without a session", async ({
  request,
}) => {
  const response = await request.get("/api/backend/auth/me");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: "Unauthorized",
    message: "Not authenticated",
  });
});

test("the mock auth endpoint rejects a lookalike session cookie", async ({
  request,
}) => {
  const response = await request.get("/api/backend/auth/me", {
    headers: { cookie: `other_${SESSION_COOKIE}=e2e` },
  });

  expect(response.status()).toBe(401);
});

test("a new installation redirects login to registration", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "e2e_setup_required",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toBeVisible();
});

test("login flow signs in and reveals the account menu", async ({ page }) => {
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
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );
  await page.route("**/api/backend/auth/login", async (route) => {
    authenticated = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(200, TRIAL_USER));
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
});

async function routeMe(page: Page, user: AuthUser) {
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, user)),
  );
}

test("the account menu offers the operator surfaces to a platform operator", async ({
  page,
}) => {
  await seedSession(page);
  await routeMe(page, { ...TRIAL_USER, platformOperator: true });

  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();

  await expect(
    page.getByRole("menuitem", { name: "Queue dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "API docs" })).toBeVisible();
});

test("the account menu hides the operator surfaces from a workspace owner", async ({
  page,
}) => {
  await seedSession(page);
  await routeMe(page, {
    ...TRIAL_USER,
    role: "owner",
    platformOperator: false,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();

  await expect(
    page.getByRole("menuitem", { name: "Change password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Queue dashboard" }),
  ).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "API docs" })).toHaveCount(0);
});

test("login rejects an encoded cross-origin destination", async ({ page }) => {
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
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );
  await page.route("**/api/backend/auth/login", async (route) => {
    authenticated = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(200, TRIAL_USER));
  });

  await page.goto("/login?next=/%5C%5Cevil.example");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("http://localhost:3000/");
});

test("registration lands in the authenticated application", async ({
  page,
}) => {
  let authenticated = false;
  await page.context().addCookies([
    {
      name: "e2e_setup_required",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: false,
        registrationOpen: true,
        setupRequired: !authenticated,
        authenticated,
      }),
    ),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );
  await page.route("**/api/backend/auth/register", async (route) => {
    authenticated = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(201, TRIAL_USER));
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
});

test("registration stays put when a guarded query is rejected", async ({
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
  let rejected = 0;
  await page.route("**/api/backend/actions/summary", (route) => {
    rejected += 1;
    return route.fulfill(
      fulfillJson(401, {
        statusCode: 401,
        error: "Unauthorized",
        message: "Not authenticated",
        path: "/actions/summary",
        timestamp: new Date().toISOString(),
      }),
    );
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Email")).toHaveValue("owner@example.com");
  expect(rejected).toBe(0);
});

test("an active trial shows the upgrade banner", async ({ page }) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: false,
    setupRequired: false,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );

  await page.goto("/");
  await expect(page.getByText(/Trial ends in 5 days/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Upgrade" })).toBeVisible();
});

test("settings creates, reveals and revokes an api token", async ({ page }) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: false,
    registrationOpen: false,
    setupRequired: false,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );

  let tokens: ApiTokenItem[] = [];
  await page.route("**/api/backend/auth/tokens", (route) => {
    if (route.request().method() === "POST") {
      const item: ApiTokenItem = {
        id: "t1",
        name: "ci",
        prefix: "asob_1234567",
        scope: "read",
        expiresAt: null,
        expired: false,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
      tokens = [item];
      return route.fulfill(
        fulfillJson(201, { ...item, token: `asob_${"a".repeat(48)}` }),
      );
    }
    return route.fulfill(fulfillJson(200, tokens));
  });
  await page.route("**/api/backend/auth/tokens/*", (route) => {
    tokens = [];
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/settings");
  await expect(page.getByText("API tokens")).toBeVisible();

  await page.getByRole("button", { name: "New token" }).click();
  await page.getByLabel("Name").fill("ci");
  await page.getByRole("button", { name: "Create token" }).click();

  await expect(
    page.getByRole("dialog", { name: "Copy your token" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "New api token" }),
  ).toHaveValue(`asob_${"a".repeat(48)}`);
  await page.getByRole("button", { name: "Done" }).click();

  await expect(
    page.getByRole("cell", { name: "ci", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Revoke ci" }).click();
  await page.getByRole("button", { name: "Revoke", exact: true }).click();

  await expect(
    page.getByRole("cell", { name: "ci", exact: true }),
  ).toBeHidden();
});

test("a lapsed workspace is told collection paused, not that it lost its data", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(
      fulfillJson(200, {
        ...TRIAL_USER,
        plan: "free",
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        entitled: false,
      }),
    ),
  );

  await page.goto("/settings");
  await expect(
    page.getByText("Collection is paused", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Choose a plan" }).first(),
  ).toBeVisible();
});

test("a 402 response redirects to the upgrade page", async ({ page }) => {
  await seedSession(page);
  await page.route("**/api/backend/health", (route) =>
    route.fulfill(
      fulfillJson(402, {
        statusCode: 402,
        error: "Payment Required",
        message: "Trial expired — upgrade to keep using asobeast",
        path: "/health",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/");
  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(page.getByText("Keep optimizing without limits")).toBeVisible();
});

const INDIE_PLAN: AccountPlan = {
  plan: "indie",
  displayName: "Indie",
  billing: true,
  entitled: true,
  hasBillingAccount: true,
  subscribed: true,
  subscriptionStalled: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  renewsAt: "2026-09-09T00:00:00.000Z",
  upgradeTo: "ultimate",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.indie,
  usage: {
    apps: { used: 3, limit: PLAN_LIMITS.indie.apps },
    keywordMarkets: { used: 240, limit: PLAN_LIMITS.indie.keywordMarkets },
  },
};

const LAPSED_PLAN: AccountPlan = {
  ...INDIE_PLAN,
  plan: "free",
  displayName: "Free",
  entitled: false,
  subscribed: false,
  renewsAt: null,
  upgradeTo: "indie",
  limits: PLAN_LIMITS.free,
  usage: {
    apps: { used: 3, limit: PLAN_LIMITS.free.apps },
    keywordMarkets: { used: 240, limit: PLAN_LIMITS.free.keywordMarkets },
  },
};

async function routePlan(page: Page, plan: AccountPlan) {
  await page.route("**/api/backend/auth/plan", (route) =>
    route.fulfill(fulfillJson(200, plan)),
  );
}

test("settings hides the plan section on a self hosted instance", async ({
  page,
}) => {
  await seedSession(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Capacity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan" })).toBeHidden();
});

test("settings shows the plan, its usage and the upgrade path", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, INDIE_PLAN);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await expect(page.getByText("3 of 5")).toBeVisible();
  await expect(page.getByText("240 of 1,000")).toBeVisible();

  await page.getByRole("link", { name: "Upgrade plan" }).click();
  await expect(page).toHaveURL(/\/upgrade$/);
});

test("an owner reaches the stripe portal from the plan card", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, INDIE_PLAN);

  let opened = false;
  await page.route("**/api/backend/billing/portal", async (route) => {
    opened = true;
    await route.fulfill(
      fulfillJson(200, { url: "http://localhost:4100/stripe-portal" }),
    );
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: "Manage billing" }).click();

  await expect.poll(() => opened).toBe(true);
});

test("a lapsed workspace is told what it keeps and what it must buy", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, LAPSED_PLAN);

  await page.goto("/settings");
  await expect(page.getByText("Access paused")).toBeVisible();
  await expect(
    page.getByText("Your data stays readable and exportable", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a plan" })).toBeVisible();
});

test("a workspace whose subscription stalled is sent to the portal, not the paywall", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, {
    ...LAPSED_PLAN,
    subscribed: true,
    subscriptionStalled: true,
  });

  await page.goto("/settings");
  await expect(
    page.getByText("stopped collecting", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume plan" })).toBeVisible();

  await page.goto("/upgrade");
  await expect(
    page.getByRole("button", { name: "Resume in the billing portal" }).first(),
  ).toBeVisible();
});

test("the upgrade page lists both paid plans with their limits", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, { ...INDIE_PLAN, subscribed: false });

  await page.goto("/upgrade");
  await expect(page.getByText("$10", { exact: true })).toBeVisible();
  await expect(page.getByText("$99", { exact: true })).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose Ultimate" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Annual" }).click();
  await expect(page.getByText("$100", { exact: true })).toBeVisible();
  await expect(page.getByText("$990", { exact: true })).toBeVisible();
});

test("the upgrade page sends a configured plan to stripe checkout", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, {
    ...INDIE_PLAN,
    plan: "trial",
    displayName: "Trial",
    subscribed: false,
  });
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        prices: [
          {
            plan: "indie",
            interval: "month",
            priceId: "price_indie_month",
            amountUsd: 10,
          },
        ],
      }),
    ),
  );

  let requested: Record<string, unknown> | null = null;
  await page.route("**/api/backend/billing/checkout", async (route) => {
    requested = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill(
      fulfillJson(200, { url: "http://localhost:4100/stripe-checkout" }),
    );
  });

  await page.goto("/upgrade");
  await expect(
    page.getByRole("button", { name: "Choose Ultimate" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Choose Indie" }).click();

  await expect.poll(() => requested).toEqual({ priceId: "price_indie_month" });
});

test("an existing subscriber changes plan in the portal instead of buying a second one", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, INDIE_PLAN);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        prices: [
          {
            plan: "ultimate",
            interval: "month",
            priceId: "price_ultimate_month",
            amountUsd: 99,
          },
        ],
      }),
    ),
  );

  let checkoutCalls = 0;
  await page.route("**/api/backend/billing/checkout", async (route) => {
    checkoutCalls += 1;
    await route.fulfill(fulfillJson(200, { url: "http://localhost:4100/no" }));
  });
  let portalCalls = 0;
  await page.route("**/api/backend/billing/portal", async (route) => {
    portalCalls += 1;
    await route.fulfill(
      fulfillJson(200, { url: "http://localhost:4100/stripe-portal" }),
    );
  });

  await page.goto("/upgrade");
  await expect(
    page.getByRole("button", { name: "Choose Ultimate" }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "Change in the billing portal" })
    .click();

  await expect.poll(() => portalCalls).toBe(1);
  expect(checkoutCalls).toBe(0);
});

test("a spent confirmation link offers a new one", async ({ page }) => {
  await seedSession(page);
  await page.route("**/api/backend/auth/verify", (route) =>
    route.fulfill(
      fulfillJson(404, {
        statusCode: 404,
        error: "Not Found",
        message: "That verification link is no longer valid",
        path: "/auth/verify",
        timestamp: new Date().toISOString(),
      }),
    ),
  );
  let resends = 0;
  await page.route("**/api/backend/auth/verify/resend", async (route) => {
    resends += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/verify?token=spent");
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(
    page.getByText("That verification link is no longer valid"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Send me a new link" }).click();

  await expect.poll(() => resends).toBe(1);
  await expect(
    page.getByRole("button", { name: "New link sent" }),
  ).toBeDisabled();
});

test("settings lists the workspace team and its pending invitations", async ({
  page,
}) => {
  await seedSession(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "teammate@example.com", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "pending@example.com", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Invite member" }),
  ).toBeVisible();
});

test("an invitation link without a token explains itself", async ({ page }) => {
  await page.goto("/invite");
  await expect(
    page.getByRole("heading", { name: "Invitation link incomplete" }),
  ).toBeVisible();
});

test("an invited teammate sets a password and lands in the workspace", async ({
  page,
}) => {
  let accepted: Record<string, unknown> | null = null;
  await page.route("**/api/backend/workspace/invites/accept", async (route) => {
    accepted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      ...fulfillJson(201, TRIAL_USER),
      headers: { "set-cookie": `${SESSION_COOKIE}=e2e; Path=/` },
    });
  });

  await page.goto("/invite?token=invitation-token-value");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(/localhost:3000\/$/);
  expect(accepted).toMatchObject({
    token: "invitation-token-value",
    password: "supersecret1",
  });
});

test("the login card offers recovery to someone who forgot their password", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});

test("recovery says the same thing whether or not the address has an account", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/api/backend/auth/password/forgot", async (route) => {
    requested.push((route.request().postDataJSON() as { email: string }).email);
    await route.fulfill({ status: 204, body: "" });
  });

  const confirmationFor = async (email: string): Promise<string> => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    return ((await status.textContent()) ?? "").replace(email, "{address}");
  };

  const known = await confirmationFor("owner@example.com");
  const unknown = await confirmationFor("stranger@example.com");

  expect(unknown).toBe(known);
  expect(requested).toEqual(["owner@example.com", "stranger@example.com"]);
});

test("a recovery link without a token explains itself", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(
    page.getByRole("heading", { name: "Recovery link incomplete" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ask for a new link" }),
  ).toBeVisible();
});

test("a spent recovery link offers a fresh one", async ({ page }) => {
  await page.route("**/api/backend/auth/password/reset", (route) =>
    route.fulfill(
      fulfillJson(404, {
        statusCode: 404,
        error: "Not Found",
        message: "That recovery link is no longer valid",
        path: "/auth/password/reset",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/reset-password?token=spent");
  await page.getByLabel("New password").fill("brandnewsecret2");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(
    page.getByText("That recovery link is no longer valid"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ask for a new link" }),
  ).toBeVisible();
});

test("a recovered account signs in with the password it just chose", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/backend/auth/password/reset", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );
  await page.route("**/api/backend/auth/login", async (route) => {
    await seedSession(page);
    await route.fulfill(fulfillJson(200, TRIAL_USER));
  });

  await page.goto("/reset-password?token=recovery-token-value");
  await page.getByLabel("New password").fill("brandnewsecret2");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(page.getByRole("status")).toContainText("Your password is set");
  expect(submitted).toEqual({
    token: "recovery-token-value",
    password: "brandnewsecret2",
  });

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("brandnewsecret2");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test("recovery refuses a password shorter than the account rules allow", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/backend/auth/password/reset", async (route) => {
    attempts += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/reset-password?token=recovery-token-value");
  await page.getByLabel("New password").fill("short");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(
    page.getByText("Password must be at least 10 characters."),
  ).toBeVisible();
  expect(attempts).toBe(0);
});
