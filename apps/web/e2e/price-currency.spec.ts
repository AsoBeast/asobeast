import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_EUR_ID,
  APP_JPY_ID,
  APP_UNKNOWN_CURRENCY_ID,
} from "./fixtures.mts";

const refresh = async (page: Page, id: string) => {
  await page.goto(`/apps/${id}/metadata`);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Snapshot refreshed" });
};

test("the overview header writes the price in euros", async ({ page }) => {
  await page.goto(`/apps/${APP_EUR_ID}`);

  await expect(page.getByText("€4.99", { exact: true })).toBeVisible();
  await expect(page.getByText("$4.99")).toHaveCount(0);
});

test("the overview header writes a yen price without decimals", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_JPY_ID}`);

  await expect(page.getByText("¥500", { exact: true })).toBeVisible();
  await expect(page.getByText("$500.00")).toHaveCount(0);
});

test("the overview header writes a price with no known currency as a bare number", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_UNKNOWN_CURRENCY_ID}`);

  await expect(page.getByText("3.50", { exact: true })).toBeVisible();
  await expect(page.getByText("$3.50")).toHaveCount(0);
});

test("the refresh dialog writes the price in euros", async ({ page }) => {
  const dialog = await refresh(page, APP_EUR_ID);

  await expect(
    dialog.getByRole("row", { name: "Price Free €4.99" }),
  ).toBeVisible();
});

test("the refresh dialog writes a yen price without a dollar sign", async ({
  page,
}) => {
  const dialog = await refresh(page, APP_JPY_ID);

  await expect(
    dialog.getByRole("row", { name: "Price Free ¥500" }),
  ).toBeVisible();
  await expect(dialog).not.toContainText("$");
});

test("the refresh dialog writes a price with no known currency as a bare number", async ({
  page,
}) => {
  const dialog = await refresh(page, APP_UNKNOWN_CURRENCY_ID);

  await expect(
    dialog.getByRole("row", { name: "Price Free 3.50" }),
  ).toBeVisible();
});

test("a competitor card writes its price in its own storefront currency", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_JPY_ID}/competitors`);

  await expect(page.getByText("PLN 9.99", { exact: true })).toBeVisible();
});

test("the changes timeline writes each price change in the currency of its storefront", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_JPY_ID}/changes`);

  const prices = page.locator('[data-change-field="price"]');
  await expect(prices.filter({ hasText: "Yen Priced" })).toContainText("¥500");
  await expect(
    prices.filter({ hasText: "Rival Polska" }).first(),
  ).toContainText("PLN 9.99");
  await expect(prices.filter({ hasText: "Rival Polska" }).last()).toContainText(
    "2.50",
  );
  await expect(prices.filter({ hasText: "$" })).toHaveCount(0);
});
