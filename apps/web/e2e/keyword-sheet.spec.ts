import type { Page } from "@playwright/test";
import { pressFromKeyboard } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const KEYWORDS = "/apps/app-1/keywords";

const opener = (page: Page, keyword: string) =>
  page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("button", { name: keyword, exact: true });

const sheet = (page: Page, keyword: string) =>
  page.getByRole("dialog", { name: new RegExp(`^${keyword}`) });

test("pressing a keyword opens its sheet with everything about it", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await pressFromKeyboard(await hydrated(opener(page, "study timer")));

  await expect(page).toHaveURL(/keyword=kw-3/);
  const dialog = sheet(page, "study timer");
  await expect(dialog).toBeVisible();
  for (const heading of [
    "What to know",
    "Position history",
    "Search results",
    "In your listing",
    "Scores and where they come from",
  ]) {
    await expect(dialog.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(dialog).toContainText("App Store · United States");
  await expect(dialog).toContainText("Position 7");
});

test("escape closes the sheet and returns to the keyword", async ({ page }) => {
  await page.goto(KEYWORDS);
  await pressFromKeyboard(await hydrated(opener(page, "study timer")));
  await expect(sheet(page, "study timer")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(sheet(page, "study timer")).toHaveCount(0);
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(opener(page, "study timer")).toBeFocused();
});

test("a link opens the sheet of its keyword", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=kw-1`);

  await expect(sheet(page, "focus timer")).toBeVisible();
});

test("a keyword the market does not track opens nothing", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=missing`);

  await expect(opener(page, "focus timer")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("all results swaps the sheet for the search results", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=kw-3`);
  const dialog = sheet(page, "study timer");

  await dialog
    .getByRole("button", { name: "All results and earlier days" })
    .click();

  await expect(page).toHaveURL(/serp=kw-3/);
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(
    page.getByRole("dialog", { name: "Search results" }),
  ).toBeVisible();
});
