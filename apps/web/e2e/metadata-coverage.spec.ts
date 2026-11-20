import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { WORDS_SPLIT_COOKIE } from "./fixtures.mts";
import { seedCookies } from "./routes.mts";

const coverageRows = (page: Page) =>
  page.getByRole("table", { name: /Keyword coverage across/ }).getByRole("row");

test("keyword coverage filters to uncovered rows, searches and sorts", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");
  await page.waitForLoadState("networkidle");
  const rows = coverageRows(page);
  await expect(rows).toHaveCount(4);

  await page.getByRole("switch", { name: "Uncovered only" }).click();

  await expect(page).toHaveURL(/uncovered=true/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("productivity app");
  await expect(rows.nth(1).getByText("Uncovered")).toBeVisible();
  await expect(page.getByText("1 of 3 keywords")).toBeVisible();

  await page.getByRole("switch", { name: "Uncovered only" }).click();
  await expect(page).not.toHaveURL(/uncovered=/);

  await page.getByRole("textbox", { name: "Search keywords" }).fill("pomo");
  await expect(page).toHaveURL(/q=pomo/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(rows).toHaveCount(4);

  const bucket = page.getByRole("button", { name: "Bucket", exact: true });
  await bucket.click();
  await expect(page).toHaveURL(/sort=bucket/);
  await expect(rows.nth(1)).toContainText("focus timer");
  await bucket.click();
  await expect(page).toHaveURL(/dir=desc/);
  await expect(rows.nth(1)).toContainText("productivity app");

  await page.getByRole("button", { name: "Keyword", exact: true }).click();
  await expect(page).toHaveURL(/sort=keyword/);
  await expect(rows.nth(1)).toContainText("focus timer");
  await expect(rows.nth(3)).toContainText("productivity app");
});

test("labels a keyword whose words are split across the fields and keeps it out of uncovered", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [WORDS_SPLIT_COOKIE]: "1" });
  await page.goto("/apps/app-1/metadata");

  const split = coverageRows(page).filter({ hasText: "study focus" });
  await expect(split.getByText("Words split", { exact: true })).toBeVisible();
  await expect(split.getByText("Uncovered")).toHaveCount(0);
  await expect(
    page.getByText(/^Words split means every word of the keyword/),
  ).toBeVisible();

  await page.getByRole("switch", { name: "Uncovered only" }).click();

  await expect(page).toHaveURL(/uncovered=true/);
  await expect(
    coverageRows(page).filter({ hasText: "study focus" }),
  ).toHaveCount(0);
});
