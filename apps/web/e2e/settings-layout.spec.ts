import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  API_TOKENS_COOKIE,
  LONG_ALERT_COOKIE,
  SOLO_TEAM_COOKIE,
} from "./settings-fixtures.mts";
import {
  PLAY_CONNECTION_COOKIE,
  STORE_CONNECTION_COOKIE,
} from "./store-connections.mts";

const seed = (context: BrowserContext, cookies: Record<string, string>) =>
  context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );

const index = (page: Page) =>
  page.getByRole("navigation", { name: "On this page" });

async function sameRow(title: Locator, action: Locator) {
  const [heading, control] = await Promise.all([
    title.boundingBox(),
    action.boundingBox(),
  ]);
  if (!heading || !control) throw new Error("the header is not drawn");
  expect(control.x).toBeGreaterThan(heading.x + 96);
  expect(
    Math.abs(control.y + control.height / 2 - (heading.y + heading.height / 2)),
  ).toBeLessThan(12);
}

const fitsTheViewport = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

test("every settings panel puts its action at the right of its title", async ({
  page,
}) => {
  await page.goto("/settings");

  for (const [title, action] of [
    ["Delivery", "Flush now"],
    ["Webhooks", "Add webhook"],
    ["Email", "Add email alert"],
    ["Team", "Invite member"],
    ["Delete workspace", "Delete workspace"],
  ]) {
    await sameRow(
      page.getByRole("heading", { name: title, exact: true }),
      page.getByRole("button", { name: action, exact: true }),
    );
  }
});

test("the settings index lists the sections shown and marks the one in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");

  const links = index(page).getByRole("link");
  await expect(links).toHaveText([
    "Capacity",
    "Getting started",
    "Alerts",
    "Team",
    "Workspace",
  ]);
  await expect(index(page).locator('[aria-current="location"]')).toHaveText(
    "Capacity",
  );

  await index(page).getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(page.getByRole("region", { name: "Team" })).toBeInViewport();
  await expect(index(page).locator('[aria-current="location"]')).toHaveText(
    "Team",
  );
});

test("the settings index leaves when the column has no room beside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(index(page)).toBeHidden();
});

test("a channel says what it sends in one line, long address and every rule included", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await seed(page.context(), {
    [LONG_ALERT_COOKIE]: "1",
    [SOLO_TEAM_COOKIE]: "solo",
  });
  await page.goto("/settings");

  const row = page
    .getByRole("listitem")
    .filter({ hasText: "release-notifications-for-the-whole-mobile-team" });
  await expect(row.locator('[data-slot="alert-rule"]')).toHaveCount(18);
  await expect(row).toContainText("Confirmed drops · Sends Metadata changed");
  await expect(row).toContainText("Rank dropped · 10+");
  await expect(
    page.getByRole("region", { name: "Team" }).getByText("1 member"),
  ).toBeVisible();
  expect(await fitsTheViewport(page)).toBe(true);
});

test("recent deliveries count what was delivered and show when", async ({
  page,
}) => {
  await page.goto("/settings");

  const row = page.getByRole("listitem").filter({ hasText: "ops@example.com" });
  await row.getByRole("button", { name: "Recent deliveries" }).click();

  await expect(row.getByText("1 of 2 delivered")).toBeVisible();
  await expect(row.getByText("Failed", { exact: true })).toBeVisible();
  await expect(row.getByText(/smtp timeout/)).toBeVisible();
  await expect(row.locator("time")).toHaveCount(2);
});

test("integrations opens with what is connected and how much data each app has", async ({
  page,
}) => {
  await seed(page.context(), {
    [STORE_CONNECTION_COOKIE]: "active",
    [PLAY_CONNECTION_COOKIE]: "active",
    [API_TOKENS_COOKIE]: "many",
  });
  await page.goto("/integrations");

  await expect(
    page.getByText(
      "2 of 2 stores connected · 2 of 3 apps reporting · store data through Oct 12, 2026",
    ),
  ).toBeVisible();

  const stores = page.getByRole("region", { name: "Store connections" });
  await expect(
    stores
      .locator('[data-slot="card-action"]')
      .getByText("Connected", { exact: true }),
  ).toHaveCount(2);
  const focus = stores.getByRole("listitem").filter({ hasText: "Focus Timer" });
  await expect(focus).toContainText("1,016 days");
  await expect(focus).toContainText("through Oct 12, 2026");
  await expect(
    focus.getByRole("img", {
      name: "Data from Jan 1, 2024 to Oct 12, 2026",
    }),
  ).toBeVisible();
  await expect(
    stores.getByRole("listitem").filter({ hasText: "Habit Tracker" }),
  ).toContainText("No data yet");
  await expect(
    stores.getByText("Verified Oct 1, 2026", { exact: false }),
  ).toBeVisible();
});

test("integrations names the store that needs attention", async ({ page }) => {
  await seed(page.context(), { [STORE_CONNECTION_COOKIE]: "readOnly" });
  await page.goto("/integrations");

  await expect(
    page.getByText("App Store Connect: needs an admin key"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Store connections" })
      .getByText("Needs an Admin key", { exact: true })
      .first(),
  ).toBeVisible();
});

test("the token table shows scope as text, the expired state and each token's requests", async ({
  page,
}) => {
  await seed(page.context(), { [API_TOKENS_COOKIE]: "many" });
  await page.goto("/integrations");

  const tokens = page.getByRole("table", {
    name: "Personal API tokens for automation.",
  });
  const old = tokens.getByRole("row").filter({ hasText: "old laptop" });
  await expect(old.getByText("Expired", { exact: true })).toBeVisible();
  await expect(old.locator('[data-slot="badge"]')).toHaveCount(1);
  await expect(
    tokens.getByRole("row").filter({ hasText: "Desktop agent" }),
  ).toContainText("Read and write");
  await expect(
    tokens.getByRole("row").filter({ hasText: "staging script" }),
  ).toContainText("created Oct 10, 2026");
  await expect(
    page.getByText("4 tokens, 1 expired", { exact: false }),
  ).toBeVisible();
  await sameRow(
    page.getByRole("heading", { name: "API tokens" }),
    page.getByRole("button", { name: "New token" }),
  );
});

test("the mcp endpoint copies from its own button", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/integrations");

  await page.getByRole("button", { name: "Copy endpoint" }).click();

  await expect(page.getByText("Endpoint copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/api\/backend\/mcp$/,
  );
});

test("integrations fits a phone with a long app name and four tokens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await seed(page.context(), {
    [STORE_CONNECTION_COOKIE]: "longName",
    [API_TOKENS_COOKIE]: "many",
  });
  await page.goto("/integrations");

  await expect(
    page.getByRole("listitem").filter({ hasText: "Sleep Sounds" }),
  ).toContainText("Stopped by Apple");
  expect(await fitsTheViewport(page)).toBe(true);
});
