import type { Page, Route } from "@playwright/test";
import { VALID_CONFIRM_TOKEN, VALID_UNSUBSCRIBE_TOKEN } from "./fixtures.mts";
import { CLAIM_WINDOW_MS } from "../src/lib/focus-handoff";
import { holdRequest, pressFromKeyboard } from "./held-request.mts";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { seedCookies, SIGNED_OUT_ROUTES } from "./routes.mts";
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
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
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
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
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
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
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
  await expect(page.locator('[data-slot="not-found"]')).toBeVisible();
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

for (const [status, invalid] of [
  [400, "true"],
  [429, "false"],
] as const) {
  test(`a ${status} on the forgot password form leaves the email ${invalid === "true" ? "marked" : "valid"}`, async ({
    page,
  }) => {
    await page.route(
      "**/api/backend/auth/password/forgot",
      refuse(status, "This address cannot get a recovery link."),
    );
    await page.goto("/forgot-password");
    const email = page.getByLabel("Email");
    await email.fill("owner@example.com");

    await page.getByRole("button", { name: "Email me a link" }).click();

    await expect(
      page.getByText("This address cannot get a recovery link."),
    ).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", invalid);
    if (invalid === "true") {
      await expect(email).toHaveAccessibleDescription(
        "This address cannot get a recovery link.",
      );
    }
  });
}

const ANSWERED_REQUESTS = [
  {
    request: /\/api\/backend\/auth\/password\/forgot$/,
    path: "/forgot-password",
    fill: { Email: "owner@example.com" },
    press: "Email me a link",
    claims: { role: "link", name: "Back to sign in" },
  },
  {
    request: /\/api\/backend\/auth\/password\/reset$/,
    path: "/reset-password?token=recovery-token",
    fill: { "New password": PASSWORD },
    press: "Set new password",
    claims: { role: "link", name: "Sign in" },
  },
  {
    request: /\/api\/backend\/email-alerts\/ea_handoff\/confirm/,
    path: "/confirm-alert?alert=ea_handoff&token=confirm-token",
    fill: {},
    press: "Confirm email address",
    claims: { role: "heading", name: "Alert emails confirmed" },
  },
  {
    request: /\/api\/backend\/email-alerts\/ea_handoff\/unsubscribe/,
    path: "/unsubscribe?alert=ea_handoff&token=unsubscribe-token",
    fill: {},
    press: "Unsubscribe",
    claims: { role: "heading", name: "You are unsubscribed" },
  },
] as const;

for (const { request, path, fill, press, claims } of ANSWERED_REQUESTS) {
  test(`${press} hands focus to ${claims.name} when its answer replaces it`, async ({
    page,
  }) => {
    await page.route(request, (route) => route.fulfill({ status: 204 }));
    await page.goto(path);
    for (const [label, value] of Object.entries(fill)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }

    await pressFromKeyboard(page.getByRole("button", { name: press }));

    await expect(
      page.getByRole(claims.role, { name: claims.name, exact: true }),
    ).toBeFocused();
  });
}

for (const { request, path, fill, press, claims } of ANSWERED_REQUESTS) {
  test(`${press} hands focus to ${claims.name} after a slow answer`, async ({
    page,
  }) => {
    await page.clock.install();
    const held = await holdRequest(page, request, "POST", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(path);
    for (const [label, value] of Object.entries(fill)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }

    await pressFromKeyboard(page.getByRole("button", { name: press }));
    await page.clock.fastForward(CLAIM_WINDOW_MS + 1_000);
    held.release();

    await expect(
      page.getByRole(claims.role, { name: claims.name, exact: true }),
    ).toBeFocused();
  });
}

for (const { request, path, fill, press, claims } of ANSWERED_REQUESTS) {
  test(`${press} leaves focus where the visitor moved it while the answer was on its way`, async ({
    page,
  }) => {
    const held = await holdRequest(page, request, "POST", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(path);
    for (const [label, value] of Object.entries(fill)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    const home = page.getByRole("banner").getByRole("link", {
      name: "AsoBeast",
    });

    await pressFromKeyboard(page.getByRole("button", { name: press }));
    await home.focus();
    held.release();

    await expect(
      page.getByRole(claims.role, { name: claims.name, exact: true }),
    ).toBeVisible();
    await expect(home).toBeFocused();
  });
}

for (const { request, path, fill, press, claims } of ANSWERED_REQUESTS.filter(
  (answered) => Object.keys(answered.fill).length > 0,
)) {
  test(`${press} hands focus on from a field the answer removes`, async ({
    page,
  }) => {
    const held = await holdRequest(page, request, "POST", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(path);
    for (const [label, value] of Object.entries(fill)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }

    await pressFromKeyboard(page.getByRole("button", { name: press }));
    await page.keyboard.press("Shift+Tab");
    held.release();

    await expect(
      page.getByRole(claims.role, { name: claims.name, exact: true }),
    ).toBeFocused();
  });
}

const TITLE_STEP_PX = 24;
const NARROW_PHONE = { width: 320, height: 720 };

for (const [name, path, cookies] of SIGNED_OUT_ROUTES) {
  test(`${name} sets its one heading at the title step`, async ({
    page,
    context,
  }) => {
    await seedCookies(context, cookies);
    await page.goto(path);

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveCSS("font-size", `${TITLE_STEP_PX}px`);
  });

  test(`${name} fits a 320 px phone without sideways scroll`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(NARROW_PHONE);
    await seedCookies(context, cookies);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("the password can be shown and hidden without losing the field's name", async ({
  page,
}) => {
  await page.goto("/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill(PASSWORD);
  await expect(password).toHaveAttribute("type", "password");

  await pressFromKeyboard(page.getByRole("button", { name: "Show password" }));

  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue(PASSWORD);
  const hide = page.getByRole("button", { name: "Hide password" });
  await expect(hide).toBeFocused();

  await hide.click();
  await expect(password).toHaveAttribute("type", "password");
});

test("showing the password does not submit the form", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/backend/auth/login", async (route) => {
    attempts += 1;
    await refuse(401, "Invalid email or password")(route);
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);

  await page.getByRole("button", { name: "Show password" }).click();

  await expect(
    page.getByRole("button", { name: "Hide password" }),
  ).toBeVisible();
  expect(attempts).toBe(0);
});

test("an invitation for an address that already has an account says so", async ({
  page,
}) => {
  await page.route(
    "**/api/backend/workspace/invites/accept",
    refuse(409, "That email already has an account"),
  );
  await page.goto("/invite?token=invite-token");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill(PASSWORD);

  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(formAlert(page)).toHaveText("That email already has an account");
  await expect(password).toHaveAttribute("aria-invalid", "false");
});

test("a shown password is hidden again when the form is sent", async ({
  page,
}) => {
  await signIn(page, refuse(401, "Invalid email or password"));
  const password = page.getByLabel("Password", { exact: true });
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue(PASSWORD);
});

test("create account refuses a password that is too long before sending it", async ({
  page,
  context,
}) => {
  let attempts = 0;
  await page.route("**/api/backend/auth/register", async (route) => {
    attempts += 1;
    await route.abort();
  });
  await seedCookies(context, { e2e_setup_required: "1" });
  await page.goto("/register");
  await page.getByLabel("Email").fill("owner@example.com");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("a".repeat(129));

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(password).toHaveAccessibleDescription(
    "Use 128 characters or fewer.",
  );
  await expect(password).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toBe(0);
});

test("the recovery page names the address the request was sent for", async ({
  page,
}) => {
  const held = await holdRequest(
    page,
    /\/api\/backend\/auth\/password\/forgot$/,
    "POST",
    (route) => route.fulfill({ status: 204 }),
  );
  await page.goto("/forgot-password");
  const email = page.getByLabel("Email");
  await email.fill("first@example.com");

  await page.getByRole("button", { name: "Email me a link" }).click();
  await email.fill("second@example.com");
  held.release();

  await expect(page.getByRole("status")).toContainText(
    "If first@example.com has an account",
  );
});
