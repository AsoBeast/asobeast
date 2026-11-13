import type { Page } from "@playwright/test";
import { formatDayMonth } from "../src/lib/format";
import {
  CROWDED_COMPETITORS_COOKIE,
  FAIL_ANALYSIS_COOKIE,
  GAP_STATE_COOKIE,
  utcDaysAgo,
} from "./fixtures.mts";
import { FAIL_CHANGES_COOKIE } from "./competitors-fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/competitors";

const standing = (page: Page) =>
  page.getByRole("region", { name: "How you compare" });
const visibility = (page: Page) =>
  standing(page).getByRole("list", { name: "Visibility by app" });
const listings = (page: Page) =>
  standing(page).getByRole("list", { name: "Listing text by app" });
const matrix = (page: Page) =>
  page.getByRole("table", { name: /compared with each tracked competitor/ });
const totals = (page: Page) => matrix(page).locator("tfoot tr");

async function open(page: Page, path = PAGE): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("the lede counts the competitors and names the newest listing change", async ({
  page,
}) => {
  await open(page);

  await expect(
    page.getByText(
      `changed its screenshot images on ${formatDayMonth(utcDaysAgo(2))}.`,
    ),
  ).toBeVisible();
  await expect(page.getByText("1 competitor", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Competitors", exact: true }),
  ).toHaveCount(1);
});

test("the lede asks for a first competitor when none is tracked", async ({
  page,
}) => {
  await open(page, "/apps/app-2/competitors");

  await expect(page.getByText("No competitors", { exact: true })).toBeVisible();
  await expect(
    standing(page).getByText("Nothing to compare yet"),
  ).toBeVisible();
});

test("a failed listing changes read leaves the count and the page up", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [FAIL_CHANGES_COOKIE]: "1" });
  await open(page);

  await expect(page.getByText("1 competitor", { exact: true })).toBeVisible();
  await expect(page.getByText("tracked.", { exact: true })).toBeVisible();
  await expect(visibility(page).getByRole("listitem")).toHaveCount(2);
  await expect(matrix(page)).toBeVisible();
});

test("how you compare ranks every app by visibility and marks the own app", async ({
  page,
}) => {
  await open(page);

  const rows = visibility(page).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Focus Timer");
  await expect(rows.nth(0)).toContainText("You");
  await expect(rows.nth(0)).toContainText("Visibility 62.4");
  await expect(rows.nth(0)).toContainText("Rating 4.6");
  await expect(rows.nth(1)).toContainText("Rival Focus");
  await expect(rows.nth(1)).toContainText("Visibility 58.1");
  await expect(
    standing(page).getByRole("link", { name: "Share of voice trend" }),
  ).toHaveAttribute("href", "/apps/app-1?visView=share");
});

test("the listing text view shows each title and subtitle against its limit", async ({
  page,
}) => {
  await open(page);

  const tab = await hydrated(
    standing(page).getByRole("tab", { name: "Listing text" }),
  );
  await tab.click();

  await expect(tab).toBeFocused();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(visibility(page)).toHaveCount(0);
  const rows = listings(page).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Pomodoro & deep work");
  await expect(rows.nth(0)).toContainText("20 of 30 characters");
  await expect(rows.nth(1)).toContainText("No subtitle");
  await expect(rows.nth(1)).toContainText("0 of 30 characters");
});

test("twelve competitors list thirteen apps and keep the page inside 375 px", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [CROWDED_COMPETITORS_COOKIE]: "1" });
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page);

  await expect(visibility(page).getByRole("listitem")).toHaveCount(13);
  await expect(visibility(page).getByText("No rating")).toHaveCount(1);
  await standing(page).getByRole("tab", { name: "Listing text" }).click();
  await expect(listings(page).getByText("32 of 30 characters")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("a failed analysis offers a retry in how you compare", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [FAIL_ANALYSIS_COOKIE]: "1" });
  await open(page);

  await expect(
    standing(page).getByText("The comparison could not be loaded."),
  ).toBeVisible({ timeout: 20_000 });
  await context.clearCookies({ name: FAIL_ANALYSIS_COOKIE });
  await standing(page).getByRole("button", { name: "Retry" }).click();

  await expect(visibility(page).getByRole("listitem")).toHaveCount(2);
});

test("competitors that were not compared yet say so with the coverage hidden", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [GAP_STATE_COOKIE]: "not-compared" });
  await open(page);

  await expect(
    page.getByText("Your competitors have not been checked yet."),
  ).toBeVisible();
  await expect(page.getByText(/^Compared on /)).toHaveCount(0);
});

test("the gap list says how much of the keyword set was compared", async ({
  page,
}) => {
  await open(page);

  await expect(
    page.getByText("Compared on 9 of 11 keywords in 3 markets"),
  ).toBeVisible();
});

test("the matrix totals count the top 10 and the head to head, and follow the filters", async ({
  page,
}) => {
  await open(page);

  await expect(totals(page)).toContainText("5 keywords");
  await expect(totals(page)).toContainText("2 in top 10");
  await expect(totals(page)).toContainText("You lead 2, trail 3");

  await page.goto(`${PAGE}?vs=losing`);
  await page.waitForLoadState("networkidle");

  await expect(totals(page)).toContainText("3 keywords");
  await expect(totals(page)).toContainText("You lead 0, trail 3");
});

test("the gap row carries a neutral mark and no tint", async ({ page }) => {
  await open(page);

  const row = matrix(page).locator("tr[data-gap]");
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Gap", { exact: true })).toHaveAttribute(
    "data-variant",
    "flat",
  );
  const plain = matrix(page).locator("tbody tr:not([data-gap])").first();
  expect(
    await row.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(
    await plain.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
});

test("the keywords of a discovered app open in a named popover on click", async ({
  page,
}) => {
  await open(page);
  const name = "4 keywords where Deep Work Sessions appears";

  const trigger = await hydrated(page.getByRole("button", { name }));
  await trigger.click();

  const popover = page.getByRole("dialog", { name });
  await expect(popover.getByRole("listitem")).toHaveText([
    "focus timer",
    "pomodoro",
    "study timer",
    "time blocking",
  ]);
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
