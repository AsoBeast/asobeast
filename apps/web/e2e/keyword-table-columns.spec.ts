import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { formatDate } from "../src/lib/format";
import { utcTimestampDaysAgo } from "./fixtures.mts";

const KEYWORDS = "/apps/app-1/keywords";

async function showColumn(page: Page, name: string) {
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name }).click();
  await page.keyboard.press("Escape");
}

test("the Added column starts hidden and the Columns menu offers it", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await expect(
    page.getByRole("columnheader", { name: "Added", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Columns" }).click();

  await expect(
    page.getByRole("menuitemcheckbox", { name: "Added" }),
  ).not.toBeChecked();
});

test("shows the UTC day each keyword was added and remembers the choice", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await showColumn(page, "Added");

  const row = page.getByRole("row", { name: /time blocking/ });
  await expect(row.locator("time")).toHaveText(
    formatDate(utcTimestampDaysAgo(2)),
  );
  await expect(row.locator("time")).toHaveAttribute(
    "datetime",
    utcTimestampDaysAgo(2),
  );

  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Added", exact: true }),
  ).toBeVisible();
});

test("sorts by Added with the newest first and writes the sort to the address", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await showColumn(page, "Added");

  await page.getByRole("button", { name: "Added", exact: true }).click();

  await expect(page).toHaveURL(/sort=added/);
  await expect(page).not.toHaveURL(/dir=/);
  await expect(
    page.getByRole("columnheader", { name: "Added", exact: true }),
  ).toHaveAttribute("aria-sort", "descending");
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(rows.last()).toContainText("focus timer");

  await page.getByRole("button", { name: "Added", exact: true }).click();

  await expect(page).toHaveURL(/dir=asc/);
  await expect(rows.nth(1)).toContainText("focus timer");
});

test("opens a link that names the Added sort even while the column is hidden", async ({
  page,
}) => {
  await page.goto(`${KEYWORDS}?sort=added`);

  await expect(page.getByRole("row").nth(1)).toContainText("time blocking");
});
