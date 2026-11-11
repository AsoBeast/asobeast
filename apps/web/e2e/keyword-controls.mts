import type { Locator, Page } from "@playwright/test";

const COLUMNS_KEY = "asobeast.columns.keywords";

export const translatedFiltersButton = (page: Page): Locator =>
  page
    .locator('button[aria-haspopup="dialog"]')
    .filter({ has: page.locator("svg.lucide-list-filter") })
    .and(page.locator(":visible"));

export async function openKeywordFilters(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Filters/ }).click();
}

export async function chooseKeywordMarket(
  page: Page,
  country: string | RegExp,
): Promise<void> {
  await page.getByRole("combobox", { name: "Keyword markets" }).click();
  await page.getByRole("option", { name: country }).click();
}

export async function showKeywordColumns(
  page: Page,
  columns: readonly string[],
): Promise<void> {
  await page.addInitScript(
    ([key, shown]) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, shown);
      }
    },
    [
      COLUMNS_KEY,
      JSON.stringify(Object.fromEntries(columns.map((id) => [id, true]))),
    ] as const,
  );
}
