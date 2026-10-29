import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { formatDate } from "../src/lib/format";
import { THEMES } from "./contrast-check.mts";
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

test("shows how many competitors are in the top 10 and says why a dash is empty", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await showColumn(page, "Competitors in top 10");

  const row = (text: RegExp) => page.getByRole("row", { name: text });
  await expect(
    row(/focus timer/).getByLabel("2 competitors in the top 10"),
  ).toBeVisible();
  await expect(
    row(/pomodoro/).getByLabel("0 competitors in the top 10"),
  ).toBeVisible();
  await expect(
    row(/productivity app/).getByLabel("1 competitor in the top 10"),
  ).toBeVisible();
  await expect(
    row(/study timer/).getByLabel("Competitors in top 10: not available"),
  ).toHaveText("—");
});

test("sorts by competitors with the most first and the dashes last", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await showColumn(page, "Competitors in top 10");

  await page
    .getByRole("button", { name: "Competitors in top 10", exact: true })
    .click();

  await expect(page).toHaveURL(/sort=competitors/);
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("focus timer");
  await expect(rows.nth(2)).toContainText("productivity app");
  await expect(rows.nth(3)).toContainText("pomodoro");
});

test("the information button explains the dash and the freshness rule", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await showColumn(page, "Competitors in top 10");

  await page
    .getByRole("button", { name: "About competitors in the top 10" })
    .click();

  await expect(
    page.getByRole("dialog", { name: "Competitors in the top 10" }),
  ).toContainText("today or yesterday");
});

test("the top 10 sheet is unchanged by the new column", async ({ page }) => {
  await page.goto(KEYWORDS);
  await showColumn(page, "Competitors in top 10");

  await page
    .getByRole("button", { name: "View top 10 for focus timer" })
    .click();

  await expect(page).toHaveURL(/serp=kw-1/);
});

for (const theme of THEMES) {
  test(`both optional columns pass axe in the ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      ([value, columns]) => {
        window.localStorage.setItem("theme", value);
        window.localStorage.setItem("asobeast.columns.keywords", columns);
      },
      [theme, JSON.stringify({ added: true, competitors: true })] as const,
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(KEYWORDS);
    await expect(
      page.getByRole("columnheader", { name: /Competitors in top 10/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Added", exact: true }),
    ).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include("table")
      .withRules(["color-contrast", "th-has-data-cells"])
      .analyze();

    expect(violations.map(({ id }) => id)).toEqual([]);
  });
}

test("a phrase in quotes matches the whole keyword and says so in a chip", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill('"focus timer"');

  await expect(page).toHaveURL(/q=%22focus\+timer%22/);
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("row").nth(1)).toContainText("focus timer");
  await expect(page.getByText("Exact phrase: focus timer")).toBeVisible();
});

test("a quoted phrase that is only part of a keyword finds nothing and offers the way out", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await page.getByRole("textbox", { name: "Search keywords" }).fill('"timer"');

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await expect(
    page.getByText('No keyword is exactly "timer" with these filters.'),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Search keywords" }).fill("timer");

  await expect(page.getByRole("row")).toHaveCount(3);
});

test("an unbalanced quote searches for the words while the closing quote is still to come", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await page.getByRole("textbox", { name: "Search keywords" }).fill('"focus');

  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByText('Search: "focus')).toBeVisible();
});

test("the exact search narrows the export to the rows shown", async ({
  page,
}) => {
  await page.goto(`${KEYWORDS}?q=%22focus+timer%22`);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of keywords" }).click(),
  ]);

  const lines = readFileSync(await download.path(), "utf8")
    .trim()
    .split("\r\n");
  expect(lines).toHaveLength(2);
  expect(lines[1]).toMatch(/^focus timer,/);
});
