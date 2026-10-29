import type { BrowserContext, Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const COOKIE = "asobeast_collapsed";
const CARD = "Ratings by market";
const TABLE =
  "Rating and number of ratings on the newest listing captured in each market";
const DAY = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/;

const card = (page: Page) =>
  page.getByRole("region", { name: CARD, exact: true });
const table = (page: Page) => page.getByRole("table", { name: TABLE });
const rowOf = (page: Page, code: string) =>
  table(page)
    .locator("tbody tr")
    .filter({ has: page.getByText(code, { exact: true }) });
const cell = (page: Page, code: string, index: number) =>
  rowOf(page, code).getByRole("cell").nth(index);

const wide = (context: BrowserContext) =>
  seedCookies(context, { e2e_ratings_markets: "wide" });

async function storedCollapsed(
  context: BrowserContext,
): Promise<string | null> {
  const cookie = (await context.cookies()).find(({ name }) => name === COOKIE);
  return cookie ? decodeURIComponent(cookie.value) : null;
}

test("lists the home market first with its rating, count and day", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  const us = rowOf(page, "US");
  await expect(us).toContainText("United States");
  await expect(us).toContainText("Home");
  await expect(cell(page, "US", 1)).toContainText("4.8");
  await expect(cell(page, "US", 1)).toContainText("strong");
  await expect(cell(page, "US", 2)).toHaveText("24,000");
  await expect(cell(page, "US", 3)).toHaveText(DAY);
  await expect(table(page).locator("tbody tr").first()).toContainText("US");
  await expect(table(page).getByRole("row")).toHaveCount(4);
});

test("orders the other markets by rating count and puts a market without one last", async ({
  page,
  context,
}) => {
  await wide(context);
  await page.goto("/apps/app-1");

  await expect(table(page).locator("tbody tr")).toHaveCount(6);
  const codes = await table(page)
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector("td span.font-mono")?.textContent),
    );
  expect(codes).toEqual(["US", "DE", "PL", "BR", "BA", "JP"]);
  await expect(rowOf(page, "BA")).toContainText("Bosnia & Herzegovina");
  await expect(cell(page, "BR", 1)).toContainText("weak");
  await expect(cell(page, "JP", 1)).toContainText("No rating yet");
  await expect(cell(page, "JP", 2)).toContainText("No rating yet");
  await expect(cell(page, "JP", 3)).toHaveText("Oct 25, 2026");
});

test("averages the listed markets weighted by their rating count", async ({
  page,
  context,
}) => {
  await wide(context);
  await page.goto("/apps/app-1");

  const total = table(page).locator("tfoot tr");
  await expect(total).toContainText("All listed markets");
  await expect(total.getByRole("cell").nth(1)).toContainText("4.7");
  await expect(total.getByRole("cell").nth(2)).toHaveText("33,112");
  await expect(total.getByRole("cell").nth(3)).toHaveText("5 markets");
});

test("shows the weighted average of two markets", async ({ page }) => {
  await page.goto("/apps/app-1");

  const total = table(page).locator("tfoot tr");
  await expect(total.getByRole("cell").nth(1)).toContainText("4.8");
  await expect(total.getByRole("cell").nth(2)).toHaveText("27,100");
  await expect(total.getByRole("cell").nth(3)).toHaveText("2 markets");
});

test("marks no row while every market is chosen and the chosen market once one is", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  await expect(table(page)).toBeVisible();
  await expect(table(page).locator('tr[aria-current="true"]')).toHaveCount(0);

  await page.goto("/apps/app-1?market=pl");

  const pl = rowOf(page, "PL");
  await expect(pl).toHaveAttribute("aria-current", "true");
  await expect(pl).toContainText("Selected");
  await expect(table(page).locator('tr[aria-current="true"]')).toHaveCount(1);
  await expect(rowOf(page, "US")).not.toContainText("Selected");
});

test("moves the mark when the switcher changes", async ({ page }) => {
  await page.goto("/apps/app-1");
  const switcher = await hydrated(
    page.getByRole("combobox", { name: "Market" }),
  );
  await switcher.click();
  await page.getByRole("option", { name: "PL · Poland" }).click();

  await expect(rowOf(page, "PL")).toHaveAttribute("aria-current", "true");
  await expect(table(page).locator('tr[aria-current="true"]')).toHaveCount(1);
});

test("says a market has no capture yet", async ({ page, context }) => {
  await seedCookies(context, { e2e_ratings_markets: "uncaptured" });
  await page.goto("/apps/app-1");

  await expect(cell(page, "US", 3)).toHaveText("Not captured yet");
  await expect(cell(page, "US", 1)).toContainText("Not captured yet");
  await expect(cell(page, "US", 2)).toContainText("Not captured yet");
  await expect(table(page).locator("tfoot")).toHaveCount(0);
});

test("explains itself when the app has one market", async ({ page }) => {
  await page.goto("/apps/app-2");

  await expect(card(page)).toBeVisible();
  await expect(card(page).getByText("Only one market so far")).toBeVisible();
  await expect(
    card(page).getByRole("link", { name: "Track keywords in another market" }),
  ).toHaveAttribute("href", "/apps/app-2/keywords");
  await expect(table(page)).toHaveCount(0);
});

test("leaves a google play overview without the card", async ({ page }) => {
  await page.goto("/apps/app-gp");

  await expect(
    page.locator("[data-slot=card]").filter({ hasText: "Metadata coverage" }),
  ).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("collapses behind its title, stays collapsed on reload and keeps the other page's sections", async ({
  page,
  context,
}) => {
  await page.goto("/apps/app-1");
  const trigger = await hydrated(
    page.getByRole("button", { name: CARD, exact: true }),
  );
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await trigger.click();

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(table(page)).toHaveCount(0);
  expect(await storedCollapsed(context)).toBe("overview.ratingsByMarket");
  await page.reload();
  await expect(
    page.getByRole("button", { name: CARD, exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(table(page)).toHaveCount(0);

  await page.goto("/apps/app-1/competitors");
  const matrix = await hydrated(
    page.getByRole("button", {
      name: "Your position against every competitor",
      exact: true,
    }),
  );
  await matrix.click();
  await expect(matrix).toHaveAttribute("aria-expanded", "false");
  expect(await storedCollapsed(context)).toBe(
    "competitors.matrix,overview.ratingsByMarket",
  );
});

test("names the help popover and links the guide", async ({ page }) => {
  await page.goto("/apps/app-1");

  const help = await hydrated(
    card(page).getByRole("button", { name: "About ratings by market" }),
  );
  await help.click();

  const popover = page.getByRole("dialog", {
    name: "How ratings by market are read",
  });
  await expect(
    popover.getByRole("link", { name: "Read how ratings by market are read" }),
  ).toHaveAttribute(
    "href",
    "https://docs.asobeast.com/guides/reviews#compare-ratings-across-markets",
  );
});
