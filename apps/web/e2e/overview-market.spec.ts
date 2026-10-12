import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const SWITCHER = "Market";
const ALL = "All markets";
const HOME = "US · United States (home)";
const POLAND = "PL · Poland";

const card = (page: Page, label: string) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) });

const pickMarket = async (page: Page, name: string) => {
  await page.getByRole("combobox", { name: SWITCHER }).click();
  await page.getByRole("option", { name }).click();
};

test("counts every market until a market is chosen", async ({ page }) => {
  await page.goto("/apps/app-1");

  const switcher = page.getByRole("combobox", { name: SWITCHER });
  await expect(switcher).toHaveText(ALL);
  await expect(card(page, "Visibility · All markets")).toContainText("62");
  await expect(card(page, "Tracked keywords · All markets")).toContainText("5");
  await switcher.click();
  await expect(page.getByRole("option")).toHaveText([ALL, HOME, POLAND]);
});

test("narrows the numbers to the selected market", async ({ page }) => {
  await page.goto("/apps/app-1");
  const history = page.waitForRequest(
    /\/apps\/app-1\/visibility-history\?.*country=pl/,
  );
  const distribution = page.waitForRequest(
    /\/apps\/app-1\/rank-distribution-history\?.*country=pl/,
  );

  await pickMarket(page, POLAND);

  await expect(page).toHaveURL(/market=pl/);
  await expect(card(page, "Visibility · PL")).toContainText("19");
  await expect(card(page, "Tracked keywords · PL")).toContainText("2");
  await history;
  await distribution;
});

test("offers the home market as a choice of its own", async ({ page }) => {
  await page.goto("/apps/app-1");

  await pickMarket(page, HOME);

  await expect(page).toHaveURL(/market=us/);
  await expect(card(page, "Visibility · US")).toContainText("71");
  await expect(card(page, "Tracked keywords · US")).toContainText("3");
});

test("returns to every market", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await pickMarket(page, ALL);

  await expect(page).not.toHaveURL(/market=/);
  await expect(card(page, "Visibility · All markets")).toContainText("62");
});

test("renders the selected market in the server response", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveText(
    POLAND,
  );
  await expect(card(page, "Visibility · PL")).toContainText("19");
});

test("names no market on the cards of an app with one listing", async ({
  page,
}) => {
  await page.goto("/apps/app-2");

  await expect(card(page, "Visibility")).toBeVisible();
  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveCount(0);
});
