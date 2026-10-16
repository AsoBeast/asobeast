import type { Page } from "@playwright/test";
import { settled } from "./page-errors.mts";
import { expect, test } from "./session.mts";
import { STORE_CONNECT_OFF_COOKIE } from "./store-connections.mts";
import { seedViewer } from "./viewer.mts";

const card = (page: Page, label: string) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) });

const funnelCard = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(/^Store funnel/) });

const tile = (page: Page, scope: string, label: string) =>
  card(page, `Store funnel · ${scope}`)
    .locator('[data-slot="stat-tile"]')
    .filter({ hasText: label });

test("shows the store funnel of every market with its trend chips", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  const funnel = card(page, "Store funnel · All markets");
  await expect(tile(page, "All markets", "Impressions")).toContainText(
    "12,345",
  );
  await expect(tile(page, "All markets", "Conversion")).toContainText("3.1%");
  await expect(tile(page, "All markets", "Get taps")).toContainText("+18 7d");
  await expect(tile(page, "All markets", "Get taps")).toContainText("+18 28d");
  await expect(funnel).toContainText("Search: 62% of impressions.");
  await expect(funnel).toContainText("Last 28 complete days through");
});

test("follows the market switcher", async ({ page }) => {
  await page.goto("/apps/app-1");
  const request = page.waitForRequest(/\/apps\/app-1\/funnel\?.*country=pl/);

  await page.getByRole("combobox", { name: "Market" }).click();
  await page.getByRole("option", { name: "PL · Poland" }).click();

  await request;
  await expect(page).toHaveURL(/market=pl/);
  await expect(tile(page, "PL", "Impressions")).toContainText("2,100");
});

test("sends an owner without a connection to settings", async ({ page }) => {
  await page.goto("/apps/app-2");

  const funnel = funnelCard(page);
  await expect(funnel).toContainText(
    "Connect App Store Connect to see impressions and conversion here.",
  );
  await expect(
    funnel.getByRole("link", { name: "Connect in settings" }),
  ).toHaveAttribute("href", "/settings#store-connections");
});

test("tells a member who can connect", async ({ page }) => {
  await seedViewer(page.context(), "member");
  await page.goto("/apps/app-2");

  const funnel = funnelCard(page);
  await expect(funnel).toContainText(
    "Ask the workspace owner to connect App Store Connect.",
  );
  await expect(funnel.getByRole("link")).toHaveCount(0);
});

test("says the newest days may still grow while the windows fill", async ({
  page,
}) => {
  await page.goto("/apps/app-long");

  const funnel = funnelCard(page);
  await expect(funnel).toContainText("640");
  await expect(funnel).toContainText("no 7d data");
  await expect(funnel).toContainText(
    "Apple finishes a day within three days; the newest days may still grow.",
  );
});

test("shows no store funnel for a google play app", async ({ page }) => {
  await page.goto("/apps/app-gp");

  await expect(page.getByText(/^Store funnel/)).toHaveCount(0);
});

test("shows no store funnel while store connections are off", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: STORE_CONNECT_OFF_COOKIE,
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1");

  await expect(card(page, "Visibility · All markets")).toBeVisible();
  await expect(page.getByText(/^Store funnel/)).toHaveCount(0);
});

test("explains where the numbers come from", async ({ page }) => {
  await page.goto("/apps/app-1");

  await card(page, "Store funnel · All markets")
    .getByRole("button", { name: "About the store funnel" })
    .click();

  const help = page.getByRole("dialog", { name: "Store funnel" });
  await expect(help).toContainText("App Store Discovery and Engagement report");
  await expect(
    help.getByRole("link", { name: "Read how the numbers are read" }),
  ).toHaveAttribute("href", "https://docs.asobeast.com/guides/store-funnel");
});

test("renders the funnel in the server response without a refetch", async ({
  page,
}) => {
  const refetched: string[] = [];
  page.on("request", (request) => {
    if (/\/apps\/app-1\/funnel/.test(request.url())) {
      refetched.push(request.url());
    }
  });

  const errors = await settled(page, "/apps/app-1?market=pl");

  await expect(tile(page, "PL", "Impressions")).toContainText("2,100");
  expect(refetched).toEqual([]);
  expect(errors).toEqual([]);
});
