import { type Page } from "@playwright/test";
import {
  fulfillJson,
  routePlan,
  seedPlan,
  seedSession,
} from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";
import { seedViewer } from "./viewer.mts";
import {
  PASSWORD_RULE,
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

const MEMBER_USER: AuthUser = {
  ...TRIAL_USER,
  id: "u2",
  email: "teammate@example.com",
  name: null,
  role: "member",
  plan: "indie",
  trialEndsAt: null,
};

async function routeStatus(page: Page, status: AuthStatus) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(fulfillJson(200, status)),
  );
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

test("a signed out answer the server contradicts settles on the requested page", async ({
  page,
}) => {
  await seedSession(page);
  let statusRequests = 0;
  await page.route("**/api/backend/auth/status", (route) => {
    statusRequests += 1;
    if (statusRequests > 1) return route.continue();
    return route.fulfill(
      fulfillJson(200, {
        billing: false,
        registrationOpen: false,
        setupRequired: false,
        authenticated: false,
      }),
    );
  });

  await page.goto("/settings");

  await expect.poll(() => statusRequests).toBe(2);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(statusRequests).toBe(2);
});

test("a throttled sign in says how long to wait", async ({ page }) => {
  await routeStatus(page, {
    billing: false,
    registrationOpen: false,
    setupRequired: false,
    authenticated: false,
  });
  await page.route("**/api/backend/auth/login", (route) =>
    route.fulfill({
      ...fulfillJson(429, {
        statusCode: 429,
        error: "Too Many Requests",
        message:
          "Too many attempts from this address. Try again in 42 seconds.",
        path: "/auth/login",
        timestamp: new Date().toISOString(),
        retryAfterSeconds: 42,
      }),
      headers: { "retry-after": "42" },
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText(
      "Too many attempts from this address. Try again in 42 seconds.",
    ),
  ).toBeVisible();
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

test("a double click on Create token creates one token", async ({ page }) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: false,
    registrationOpen: false,
    setupRequired: false,
    authenticated: true,
  });
  await routeMe(page, TRIAL_USER);

  const tokens: ApiTokenItem[] = [];
  await page.route("**/api/backend/auth/tokens", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fulfill(fulfillJson(200, tokens));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const item: ApiTokenItem = {
      id: `t${tokens.length + 1}`,
      name: "ci",
      prefix: `asob_${tokens.length + 1}`,
      scope: "read",
      expiresAt: null,
      expired: false,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };
    tokens.push(item);
    return route.fulfill(
      fulfillJson(201, { ...item, token: `asob_${"a".repeat(48)}` }),
    );
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: "New token" }).click();
  await page.getByLabel("Name").fill("ci");
  await page
    .getByRole("button", { name: "Create token" })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

  await expect(
    page.getByRole("dialog", { name: "Copy your token" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("cell", { name: "ci", exact: true })).toHaveCount(
    1,
  );
  expect(tokens).toHaveLength(1);
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
  await page.route("**/api/backend/actions/summary", (route) =>
    route.fulfill(
      fulfillJson(402, {
        statusCode: 402,
        error: "Payment Required",
        message: "Trial expired — upgrade to keep using asobeast",
        path: "/actions/summary",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/settings");
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

const PENDING_PLAN: AccountPlan = {
  ...LAPSED_PLAN,
  subscribed: true,
  subscriptionPending: true,
};

const PAYMENT_CONFIRMING = "Your payment is being confirmed.";

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
  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("3 of 5")).toBeVisible();
  await expect(plan.getByText("240 of 1,000")).toBeVisible();

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

const UNCONFIRMED_USER: AuthUser = {
  ...TRIAL_USER,
  emailVerified: false,
  plan: "free",
  trialEndsAt: null,
  entitled: false,
  trialAwaitsConfirmation: true,
};

const UNCONFIRMED_PLAN: AccountPlan = { ...LAPSED_PLAN, trialEndsAt: null };

const CONFIRM_TO_START = "Confirm your email to start your free trial.";

async function openAsUnconfirmed(page: Page) {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, UNCONFIRMED_USER)),
  );
  await routePlan(page, UNCONFIRMED_PLAN);
}

test("a new account is asked to confirm its email, not to choose a plan", async ({
  page,
}) => {
  await openAsUnconfirmed(page);

  await page.goto("/");

  await expect(page.getByText(CONFIRM_TO_START)).toBeVisible();
  await expect(page.getByText("owner@example.com").first()).toBeVisible();
  await expect(page.getByText("Collection is paused")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose a plan" })).toHaveCount(
    0,
  );
});

test("the confirmation request offers a new link and says when it was sent", async ({
  page,
}) => {
  await openAsUnconfirmed(page);
  let resends = 0;
  await page.route("**/api/backend/auth/verify/resend", async (route) => {
    resends += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Send a new link" }).click();

  await expect.poll(() => resends).toBe(1);
  await expect(
    page.getByRole("button", { name: "New link sent" }),
  ).toBeDisabled();
});

test("a throttled request for a new link says why it was refused", async ({
  page,
}) => {
  await openAsUnconfirmed(page);
  await page.route("**/api/backend/auth/verify/resend", (route) =>
    route.fulfill(
      fulfillJson(429, {
        statusCode: 429,
        error: "Too Many Requests",
        message:
          "Too many attempts from this address. Try again in 42 minutes.",
        path: "/auth/verify/resend",
        timestamp: new Date().toISOString(),
        retryAfterSeconds: 2520,
      }),
    ),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Send a new link" }).click();

  await expect(
    page
      .getByRole("region", { name: /^Notifications/ })
      .getByText("Try again in 42 minutes", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send a new link" }),
  ).toBeEnabled();
});

test("registration lands on the request to confirm the email", async ({
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
        billing: true,
        registrationOpen: true,
        setupRequired: !authenticated,
        authenticated,
      }),
    ),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, UNCONFIRMED_USER)),
  );
  await routePlan(page, UNCONFIRMED_PLAN);
  await page.route("**/api/backend/auth/register", async (route) => {
    authenticated = true;
    await seedSession(page);
    await route.fulfill(fulfillJson(201, UNCONFIRMED_USER));
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(CONFIRM_TO_START)).toBeVisible();
  await expect(page.getByText("Collection is paused")).toHaveCount(0);
});

test("the upgrade page asks an unconfirmed account to confirm before it pays", async ({
  page,
}) => {
  await openAsUnconfirmed(page);
  let resends = 0;
  await page.route("**/api/backend/auth/verify/resend", async (route) => {
    resends += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/upgrade");

  await expect(page.getByText(CONFIRM_TO_START)).toBeVisible();
  await expect(page.getByText("Choose a plan to unlock asobeast.")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Choose Indie" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect.poll(() => resends).toBe(1);
});

test("settings says the trial starts when the email is confirmed", async ({
  page,
}) => {
  await openAsUnconfirmed(page);

  await page.goto("/settings");

  await expect(
    page.getByText("Open the link we emailed you when you registered", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("tracking resumes when you choose a plan", { exact: false }),
  ).toHaveCount(0);
});

test("a refused import sends an unconfirmed account to a page that asks it to confirm", async ({
  page,
}) => {
  await openAsUnconfirmed(page);
  await page.route("**/api/backend/apps", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill(
      fulfillJson(402, {
        statusCode: 402,
        error: "Payment Required",
        message: "Choose a plan to start using asobeast",
        path: "/apps",
        timestamp: new Date().toISOString(),
        entitlement: {
          plan: "free",
          trialEndsAt: null,
          planExpiresAt: null,
          upgradeTo: "indie",
          upgradePath: UPGRADE_PATH,
        },
      }),
    );
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(page.getByText(CONFIRM_TO_START)).toBeVisible();
  await expect(page.getByText("Choose a plan to unlock asobeast.")).toHaveCount(
    0,
  );
});

test("an unconfirmed member of a workspace whose trial ended is not asked to confirm", async ({
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
        ...UNCONFIRMED_USER,
        role: "member",
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        trialAwaitsConfirmation: false,
      }),
    ),
  );
  await routePlan(page, {
    ...LAPSED_PLAN,
    trialEndsAt: "2026-09-01T00:00:00.000Z",
  });

  await page.goto("/");

  await expect(
    page.getByText("Collection is paused", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(CONFIRM_TO_START)).toHaveCount(0);

  await page.goto("/upgrade");
  await expect(
    page.getByRole("heading", { name: "Your workspace owner manages billing" }),
  ).toBeVisible();
  await expect(page.getByText(CONFIRM_TO_START)).toHaveCount(0);
});

const SUSPENDED_USER: AuthUser = {
  ...TRIAL_USER,
  plan: "indie",
  trialEndsAt: null,
  suspendedAt: "2026-10-01T10:00:00.000Z",
  suspendedReason: "scraping the service",
};

const SUSPENSION_NOTICE =
  "This workspace is suspended: scraping the service. Your data stays readable and exportable and billing stays open, but changes and the daily run are paused. Contact the operator of this instance to lift it.";

async function openAs(page: Page, user: AuthUser) {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routeMe(page, user);
}

test("the owner of a suspended workspace is told it is suspended and why", async ({
  page,
}) => {
  await openAs(page, SUSPENDED_USER);

  await page.goto("/");

  await expect(page.getByText(SUSPENSION_NOTICE)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText(SUSPENSION_NOTICE)).toBeVisible();
});

test("a member of a suspended workspace is told too", async ({ page }) => {
  await openAs(page, { ...SUSPENDED_USER, role: "member" });

  await page.goto("/");

  await expect(page.getByText(SUSPENSION_NOTICE)).toBeVisible();
});

test("a suspension without a recorded reason still says it is suspended", async ({
  page,
}) => {
  await openAs(page, { ...SUSPENDED_USER, suspendedReason: null });

  await page.goto("/");

  await expect(
    page.getByText("This workspace is suspended. Your data stays readable"),
  ).toBeVisible();
});

test("a workspace that is not suspended sees no suspension notice", async ({
  page,
}) => {
  await openAs(page, { ...SUSPENDED_USER, suspendedAt: null });

  await page.goto("/");

  await expect(
    page.getByText("This workspace is suspended", { exact: false }),
  ).toHaveCount(0);
});

test("a write refused for a suspension shows the notice without a reload", async ({
  page,
}) => {
  let user: AuthUser = { ...SUSPENDED_USER, suspendedAt: null };
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, user)),
  );
  await page.route("**/api/backend/apps", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    user = SUSPENDED_USER;
    await route.fulfill(
      fulfillJson(403, {
        statusCode: 403,
        error: "Forbidden",
        message:
          "This workspace is suspended: scraping the service. Existing data stays readable and exportable, and billing remains open.",
        path: "/apps",
        timestamp: new Date().toISOString(),
      }),
    );
  });

  await page.goto("/");
  await expect(page.getByText(SUSPENSION_NOTICE)).toHaveCount(0);
  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByText(SUSPENSION_NOTICE)).toBeVisible();
});

test("a suspended workspace whose plan lapsed sees both notices", async ({
  page,
}) => {
  await openAs(page, { ...SUSPENDED_USER, plan: "free", entitled: false });
  await routePlan(page, LAPSED_PLAN);

  await page.goto("/");

  await expect(page.getByText(SUSPENSION_NOTICE)).toBeVisible();
  await expect(
    page.getByText("Collection is paused", { exact: false }),
  ).toBeVisible();
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
  const resume = page
    .getByRole("button", { name: "Resume in the billing portal" })
    .first();
  await expect(resume).toBeVisible();

  await resume.click();

  await expect.poll(() => portalCalls).toBe(1);
  expect(checkoutCalls).toBe(0);
});

test("a workspace whose first payment is confirming is asked to wait, not to pay again", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, PENDING_PLAN);

  await page.goto("/upgrade");
  await expect(
    page.getByText(PAYMENT_CONFIRMING, { exact: false }),
  ).toBeVisible();
  const waiting = page.getByRole("button", {
    name: "Confirming your payment",
  });
  await expect(waiting).toHaveCount(2);
  for (const button of await waiting.all()) await expect(button).toBeDisabled();

  await page.goto("/settings");
  await expect(
    page.getByText(PAYMENT_CONFIRMING, { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a plan" })).toHaveCount(
    0,
  );
});

test("a checkout refused while a payment confirms shows why and can be tried again", async ({
  page,
}) => {
  const message =
    "Your last payment is still being confirmed. This usually takes a minute; if it has not completed within a day the attempt expires and you can try again.";
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, LAPSED_PLAN);
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
  await page.route("**/api/backend/billing/checkout", (route) =>
    route.fulfill(
      fulfillJson(409, {
        statusCode: 409,
        error: "Conflict",
        message,
        path: "/billing/checkout",
        timestamp: new Date().toISOString(),
        billing: { reason: "checkout_in_flight", recovery: "retry" },
      }),
    ),
  );

  await page.goto("/upgrade");
  const choose = page.getByRole("button", { name: "Choose Indie" });
  await choose.click();

  await expect(page.getByText(message)).toBeVisible();
  await expect(choose).toBeEnabled();
});

test("returning from checkout reconciles the workspace and clears the marker", async ({
  page,
}) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });

  let reconcileCalls = 0;
  await seedPlan(page, LAPSED_PLAN);
  const reconcileBodies: unknown[] = [];
  await page.route("**/api/backend/auth/plan", async (route) => {
    await route.fulfill(
      fulfillJson(200, reconcileCalls > 0 ? INDIE_PLAN : LAPSED_PLAN),
    );
  });
  await page.route("**/api/backend/billing/reconcile", async (route) => {
    reconcileCalls += 1;
    reconcileBodies.push(route.request().postDataJSON());
    await route.fulfill(
      fulfillJson(200, {
        checked: 1,
        corrected: 1,
        orphanSubscriptions: [],
        unreconciled: [],
      }),
    );
  });

  await page.goto("/settings?checkout=complete&session_id=cs_test_1");

  await expect.poll(() => reconcileCalls).toBe(1);
  expect(reconcileBodies).toEqual([{ sessionId: "cs_test_1" }]);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Renews on", { exact: false })).toBeVisible();
});

test("a checkout return keeps its marker when reconciliation cannot run", async ({
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
  await page.route("**/api/backend/billing/reconcile", (route) =>
    route.fulfill(
      fulfillJson(503, {
        statusCode: 503,
        error: "Service Unavailable",
        message: "Stripe could not be reached",
        path: "/billing/reconcile",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/settings?checkout=complete&session_id=cs_test_1");

  await expect(page.getByText("Access paused")).toBeVisible();
  await expect(page).toHaveURL(/checkout=complete&session_id=cs_test_1/);
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

async function openUpgradeSoldBy(page: Page, managedPayments: boolean) {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, { ...INDIE_PLAN, subscribed: false });
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        managedPayments,
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
  await page.goto("/upgrade");
}

test("the upgrade page names link as the reseller under managed payments", async ({
  page,
}) => {
  await openUpgradeSoldBy(page, true);

  await expect(page.getByText(/Sold through Link, our reseller/)).toBeVisible();
  await expect(page.getByText(/sales tax or VAT/)).toBeVisible();
  await expect(page.getByText(/Payments are handled by Stripe/)).toHaveCount(0);
});

test("the upgrade page keeps the stripe sentence when this business sells", async ({
  page,
}) => {
  await openUpgradeSoldBy(page, false);

  await expect(page.getByText(/Payments are handled by Stripe/)).toBeVisible();
  await expect(page.getByText(/Sold through Link/)).toHaveCount(0);
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

async function openBillingAsMember(
  page: Page,
  plan: AccountPlan,
  user: AuthUser = MEMBER_USER,
) {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routeMe(page, user);
  await routePlan(page, plan);
}

async function trackBillingActions(page: Page) {
  const calls: string[] = [];
  await page.route(
    /\/api\/backend\/billing\/(checkout|portal)$/,
    async (route) => {
      calls.push(route.request().url());
      await route.fulfill(
        fulfillJson(403, {
          statusCode: 403,
          error: "Forbidden",
          message: "Only the workspace owner can do this",
          path: "/billing",
          timestamp: new Date().toISOString(),
        }),
      );
    },
  );
  return calls;
}

test("a member sees the plan read only and is told the owner manages billing", async ({
  page,
}) => {
  await openBillingAsMember(page, INDIE_PLAN);

  await page.goto("/settings");

  await expect(
    page.getByRole("region", { name: "Plan" }).getByText("3 of 5"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Upgrade plan" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Manage billing" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Your workspace owner manages billing."),
  ).toBeVisible();
});

test("the upgrade page offers a member no billing action and says who can act", async ({
  page,
}) => {
  await openBillingAsMember(page, INDIE_PLAN);
  const billingCalls = await trackBillingActions(page);

  await page.goto("/upgrade");

  await expect(
    page.getByRole("button", {
      name: /billing portal|Choose|Resume|Confirming/,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your workspace owner manages billing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to your apps" }),
  ).toBeVisible();
  expect(billingCalls).toEqual([]);
});

test("a member who hits the paywall lands on a page that explains who can act", async ({
  page,
}) => {
  await openBillingAsMember(page, LAPSED_PLAN, {
    ...MEMBER_USER,
    plan: "free",
    entitled: false,
  });
  await page.route("**/api/backend/actions/summary", (route) =>
    route.fulfill(
      fulfillJson(402, {
        statusCode: 402,
        error: "Payment Required",
        message: "Choose a plan to start using asobeast",
        path: "/actions/summary",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/settings");

  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(
    page.getByRole("heading", { name: "Your workspace owner manages billing" }),
  ).toBeVisible();
  await expect(
    page.getByText("Collection is paused", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose/ })).toHaveCount(0);
});

test("a lapsed workspace member is told to ask the owner instead of offered a plan", async ({
  page,
}) => {
  await openBillingAsMember(page, LAPSED_PLAN, {
    ...MEMBER_USER,
    plan: "free",
    entitled: false,
  });

  await page.goto("/settings");

  await expect(
    page.getByText("Collection is paused", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a plan" })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Ask your workspace owner to choose a plan.").first(),
  ).toBeVisible();
});

test("a member on a trial is not sent to an upgrade they cannot make", async ({
  page,
}) => {
  await seedSession(page);
  await routeMe(page, {
    ...TRIAL_USER,
    id: "u2",
    role: "member",
  });

  await page.goto("/");

  await expect(page.getByText("Trial ends in 5 days.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Upgrade", exact: true }),
  ).toHaveCount(0);
});

async function holdMe(page: Page, user: AuthUser) {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = (): void => undefined;
  const asked = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/backend/auth/me", async (route) => {
    requested();
    await released;
    await route.fulfill(fulfillJson(200, user));
  });
  return { asked, release };
}

test("a member is shown no billing action while the account is still loading", async ({
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
  const me = await holdMe(page, MEMBER_USER);

  await page.goto("/settings");
  await me.asked;
  await expect(
    page.getByRole("region", { name: "Plan" }).getByText("3 of 5"),
  ).toBeVisible();

  expect(await page.getByRole("link", { name: "Upgrade plan" }).count()).toBe(
    0,
  );
  expect(
    await page.getByRole("button", { name: "Manage billing" }).count(),
  ).toBe(0);

  me.release();
  await expect(
    page.getByText("Your workspace owner manages billing."),
  ).toBeVisible();
});

test("the upgrade page offers no plan while the account is still loading", async ({
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
  const me = await holdMe(page, MEMBER_USER);

  await page.goto("/upgrade");
  await me.asked;

  expect(
    await page
      .getByRole("button", { name: /billing portal|Choose|Resume|Confirming/ })
      .count(),
  ).toBe(0);

  me.release();
  await expect(
    page.getByRole("heading", { name: "Your workspace owner manages billing" }),
  ).toBeVisible();
});

test("an owner still gets every billing action", async ({ page }) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, INDIE_PLAN);

  await page.goto("/settings");

  await expect(page.getByRole("link", { name: "Upgrade plan" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage billing" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your workspace owner manages billing."),
  ).toHaveCount(0);
});

test("each plan card prints its price once", async ({ page }) => {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, { ...INDIE_PLAN, subscribed: false });

  await page.goto("/upgrade");
  await expect(page.getByText("$10 /month")).toHaveCount(1);
  await expect(page.getByText("$99 /month")).toHaveCount(1);
  await expect(page.getByText("Billed monthly")).toHaveCount(2);

  await page.getByRole("tab", { name: "Annual" }).click();
  await expect(page.getByText("$100 /year")).toHaveCount(1);
  await expect(page.getByText("$990 /year")).toHaveCount(1);
  await expect(page.getByText("two months free", { exact: false })).toHaveCount(
    2,
  );
});

async function openSettingsWithPlan(
  page: Page,
  plan: AccountPlan,
  budgetQuota: "lapsed" | "over",
) {
  await seedSession(page);
  await routeStatus(page, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  await routePlan(page, plan);
  await page.context().addCookies([
    {
      name: "e2e_budget_quota",
      value: budgetQuota,
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/settings");
}

test("the plan card reads a workspace with no plan as tracked, not as over a limit", async ({
  page,
}) => {
  await openSettingsWithPlan(page, LAPSED_PLAN, "lapsed");

  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("3 of 0")).toHaveCount(0);
  await expect(plan.getByText("3 tracked, none included")).toBeVisible();
  await expect(plan.getByText("240 tracked, none included")).toBeVisible();
});

test("the plan card tells a customer their keywords exceed the plan", async ({
  page,
  context,
}) => {
  await seedViewer(context, "customer");
  await openSettingsWithPlan(page, INDIE_PLAN, "over");

  await expect(
    page
      .getByRole("region", { name: "Plan" })
      .getByText(/Over the keyword limit since/),
  ).toBeVisible();
});

test("the plan card does not warn about a keyword limit a workspace with no plan never had", async ({
  page,
}) => {
  await openSettingsWithPlan(page, LAPSED_PLAN, "lapsed");

  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("240 tracked, none included")).toBeVisible();
  await expect(plan.getByText("Over the keyword limit")).toHaveCount(0);
});

const PAID_UNCONFIRMED_USER: AuthUser = {
  ...TRIAL_USER,
  emailVerified: false,
  plan: "indie",
  trialEndsAt: null,
  trialAwaitsConfirmation: false,
};

async function expectConfirmationWithoutTrialPromise(page: Page) {
  await page.goto("/verify?token=link");

  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();
  await expect(page.getByText(/trial/i)).toHaveCount(0);
  await expect(
    page.getByText(
      "Confirming marks this address as yours and signs you in on this device.",
    ),
  ).toBeVisible();
}

test("the confirmation page promises no trial to a paid workspace", async ({
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
    route.fulfill(fulfillJson(200, PAID_UNCONFIRMED_USER)),
  );

  await expectConfirmationWithoutTrialPromise(page);
});

test("the confirmation page promises no trial to a signed out visitor", async ({
  page,
}) => {
  await expectConfirmationWithoutTrialPromise(page);
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

test("every form that sets a password states the rule beside the field", async ({
  page,
}) => {
  await routeStatus(page, {
    billing: false,
    registrationOpen: true,
    setupRequired: true,
    authenticated: false,
  });
  await page.context().addCookies([
    {
      name: "e2e_setup_required",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/register");
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(
    PASSWORD_RULE,
  );

  await page.goto("/invite?token=invitation-token-value");
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(
    PASSWORD_RULE,
  );

  await page.goto("/reset-password?token=recovery-token-value");
  await expect(page.getByLabel("New password")).toHaveAccessibleDescription(
    PASSWORD_RULE,
  );
});

test("the change password dialog states the rule beside the new password", async ({
  page,
}) => {
  await seedSession(page);
  await routeMe(page, TRIAL_USER);

  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Change password" }).click();

  await expect(page.getByLabel("New password")).toHaveAccessibleDescription(
    PASSWORD_RULE,
  );
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

  await expect(page.locator("#password-error")).toHaveText(
    "Password must be between 10 and 128 characters.",
  );
  await expect(page.getByLabel("New password")).toHaveAccessibleDescription(
    `${PASSWORD_RULE} Password must be between 10 and 128 characters.`,
  );
  expect(attempts).toBe(0);
});

test("recovery refuses a password that is only whitespace before sending it", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/backend/auth/password/reset", async (route) => {
    attempts += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/reset-password?token=recovery-token-value");
  await page.getByLabel("New password").fill(" ".repeat(10));
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(page.locator("#password-error")).toHaveText(PASSWORD_RULE);
  expect(attempts).toBe(0);
});

test.describe("an auth form error marks the field it is about", () => {
  const openRegistration = async (page: Page) => {
    await page.context().addCookies([
      {
        name: "e2e_setup_required",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await routeStatus(page, {
      billing: false,
      registrationOpen: true,
      setupRequired: true,
      authenticated: false,
    });
  };

  const envelope = (statusCode: number, message: string, path: string) =>
    fulfillJson(statusCode, {
      statusCode,
      error: statusCode === 409 ? "Conflict" : "Unauthorized",
      message,
      path,
      timestamp: new Date().toISOString(),
    });

  test("a password error marks only the password field invalid", async ({
    page,
  }) => {
    await openRegistration(page);
    await page.goto("/register");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByLabel("Password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("Email")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("an email that is already registered marks only the email field invalid", async ({
    page,
  }) => {
    await openRegistration(page);
    await page.route("**/api/backend/auth/register", (route) =>
      route.fulfill(
        envelope(409, "Email already registered", "/auth/register"),
      ),
    );
    await page.goto("/register");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").fill("supersecret1");
    await page.getByRole("button", { name: "Create account" }).click();

    const email = page.getByLabel("Email");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Email already registered");
    await expect(page.getByLabel("Password")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("a wrong current password marks only the current password field invalid", async ({
    page,
  }) => {
    await seedSession(page);
    await routeMe(page, TRIAL_USER);
    await page.route("**/api/backend/auth/password", (route) =>
      route.fulfill(
        envelope(401, "Invalid current password", "/auth/password"),
      ),
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Change password" }).click();
    await page.getByLabel("Current password").fill("wrongsecret1");
    await page.getByLabel("New password").fill("brandnewsecret2");
    await page.getByRole("button", { name: "Change password" }).click();

    const current = page.getByLabel("Current password");
    await expect(current).toHaveAttribute("aria-invalid", "true");
    await expect(current).toHaveAccessibleDescription(
      "Invalid current password",
    );
    await expect(page.getByLabel("New password")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
