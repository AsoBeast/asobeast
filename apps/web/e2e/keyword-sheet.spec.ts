import type { Page } from "@playwright/test";
import { settleAnimations } from "./dialog.mts";
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
    "Scores and where they come from",
    "In your listing",
    "Tags and note",
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

test("back closes the sheet and stays on the page", async ({ page }) => {
  await page.goto(KEYWORDS);
  await (await hydrated(opener(page, "study timer"))).click();
  await expect(sheet(page, "study timer")).toBeVisible();

  await page.goBack();

  await expect(sheet(page, "study timer")).toHaveCount(0);
  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
});

test("the header stays in view while the sections scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto(`${KEYWORDS}?keyword=kw-1`);
  const dialog = sheet(page, "focus timer");
  await expect(dialog).toBeVisible();

  await dialog
    .getByRole("heading", { name: "Scores and where they come from" })
    .scrollIntoViewIfNeeded();

  await expect(
    dialog.getByRole("heading", { name: /^focus timer/ }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Keyword actions for focus timer" }),
  ).toBeInViewport();
});

test("a link opens the sheet of its keyword", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=kw-1`);
  await expect(sheet(page, "focus timer")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await expect(opener(page, "focus timer")).toBeFocused();
});

test("a keyword the market does not track opens nothing", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=missing`);

  await expect(opener(page, "focus timer")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("all results opens the search results and closing them returns to the sheet", async ({
  page,
}) => {
  await page.goto(`${KEYWORDS}?keyword=kw-3`);
  const dialog = sheet(page, "study timer");

  await dialog
    .getByRole("button", { name: "All results and earlier days" })
    .click();

  await expect(page).toHaveURL(/serp=kw-3/);
  const results = page.getByRole("dialog", { name: "Search results" });
  await expect(results).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press("Escape");

  await expect(results).toHaveCount(0);
  await expect(page).not.toHaveURL(/serp=/);
  await expect(dialog).toBeVisible();
});

test("back leaves the page once the sheet was closed", async ({ page }) => {
  await page.goto("/apps/app-1");
  await page.goto(KEYWORDS);
  await (await hydrated(opener(page, "study timer"))).click();
  await expect(sheet(page, "study timer")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await page.goBack();

  await expect(page).toHaveURL(/\/apps\/app-1$/);
});

test("the sheet says when the position comes from an older check", async ({
  page,
}) => {
  await page.goto(`${KEYWORDS}?keyword=kw-3`);
  const dialog = sheet(page, "study timer");

  await expect(dialog.locator('[data-slot="stale-check"]')).toBeVisible();
  await expect(dialog).toContainText(
    /Last checked .+; the checks since then did not finish/,
  );
});

test("the arrows step through the keywords in the order of the table", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await pressFromKeyboard(await hydrated(opener(page, "study timer")));
  const next = page.getByRole("button", { name: "Next keyword" });
  const previous = page.getByRole("button", { name: "Previous keyword" });
  await expect(sheet(page, "study timer")).toBeVisible();

  await next.focus();
  await page.keyboard.press("Enter");

  await expect(sheet(page, "time blocking")).toBeVisible();
  await expect(page).toHaveURL(/keyword=kw-5/);
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute("aria-disabled", "true");

  await previous.click();
  await expect(sheet(page, "study timer")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(opener(page, "study timer")).toBeFocused();
});

test("a phone reads the position history in the sheet", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(KEYWORDS);
  await expect(opener(page, "focus timer")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Position history: focus timer/ }),
  ).toHaveCount(0);

  await (await hydrated(opener(page, "focus timer"))).click();

  await expect(
    sheet(page, "focus timer").getByRole("region", {
      name: "Position history of focus timer",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("tags and note are edited from the sheet", async ({ page }) => {
  await page.goto(`${KEYWORDS}?keyword=kw-4`);
  const dialog = sheet(page, "productivity app");
  const edit = dialog.getByRole("button", { name: "Edit tags and note" });

  await edit.click();
  const editor = page.getByRole("dialog", { name: "Edit tags and note" });
  await expect(editor).toBeVisible();
  await settleAnimations(editor);

  await page.keyboard.press("Escape");

  await expect(editor).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(edit).toBeFocused();
});
