import type { Page } from "@playwright/test";
import { settled } from "./page-errors.mts";
import { expect, test } from "./session.mts";

const SWITCHER = "Market";
const ALL = "All markets";
const HOME = "US · United States (home)";
const POLAND = "PL · Poland";

const card = (page: Page, label: string) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) });

const tile = (page: Page, label: string) =>
  page.locator('[data-slot="stat-tile"]').filter({ hasText: label });

const chartOf = (page: Page, scope: string) =>
  page.getByRole("heading", { name: `Search visibility · ${scope}` });

const pickMarket = async (page: Page, name: string) => {
  await page.getByRole("combobox", { name: SWITCHER }).click();
  await page.getByRole("option", { name }).click();
};

test("counts every market until a market is chosen", async ({ page }) => {
  await page.goto("/apps/app-1");

  const switcher = page.getByRole("combobox", { name: SWITCHER });
  await expect(switcher).toHaveText(ALL);
  await expect(chartOf(page, "All markets")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText("62");
  await expect(tile(page, "Keywords in top 10")).toContainText("of 5 tracked");
  await switcher.click();
  await expect(page.getByRole("option")).toHaveText([ALL, HOME, POLAND]);
});

test("narrows the numbers to the selected market", async ({ page }) => {
  await page.goto("/apps/app-1");
  const history = page.waitForRequest(
    /\/apps\/app-1\/visibility-history\?.*country=pl/,
  );

  await pickMarket(page, POLAND);

  await expect(page).toHaveURL(/market=pl/);
  await expect(chartOf(page, "PL")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText("19");
  await expect(tile(page, "Keywords in top 10")).toContainText("of 2 tracked");
  await history;

  const distribution = page.waitForRequest(
    /\/apps\/app-1\/rank-distribution-history\?.*country=pl/,
  );
  await tile(page, "Keywords in top 10").click();
  await distribution;
  await expect(page).toHaveURL(/visView=top10/);
});

test("offers the home market as a choice of its own", async ({ page }) => {
  await page.goto("/apps/app-1");

  await pickMarket(page, HOME);

  await expect(page).toHaveURL(/market=us/);
  await expect(chartOf(page, "US")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText("71");
  await expect(tile(page, "Keywords in top 10")).toContainText("of 3 tracked");
});

test("returns to every market", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await pickMarket(page, ALL);

  await expect(page).not.toHaveURL(/market=/);
  await expect(chartOf(page, "All markets")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText("62");
});

for (const [market, label, scope, visibility] of [
  ["pl", POLAND, "PL", "19"],
  ["us", HOME, "US", "71"],
]) {
  test(`renders ${market} in the server response and hydrates it`, async ({
    page,
  }) => {
    const refetched: string[] = [];
    page.on("request", (request) => {
      if (/\/apps\/app-1\/summary/.test(request.url())) {
        refetched.push(request.url());
      }
    });

    const errors = await settled(page, `/apps/app-1?market=${market}`);

    await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveText(
      label,
    );
    await expect(chartOf(page, scope)).toBeVisible();
    await expect(tile(page, "Visibility")).toContainText(visibility);
    expect(refetched).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("keeps the numbers on screen while the next market loads", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/apps\/app-1\/summary\?country=pl$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/apps/app-1");

  await pickMarket(page, POLAND);

  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveText(
    POLAND,
  );
  await expect(chartOf(page, "All markets")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText("62");
  release();
  await expect(chartOf(page, "PL")).toBeVisible();
});

test("names no market on the cards of an app with one listing", async ({
  page,
}) => {
  await page.goto("/apps/app-2");

  await expect(
    page.getByRole("heading", { name: "Search visibility", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveCount(0);
});

test("says which scope the cards that ignore the switcher count", async ({
  page,
}) => {
  await page.goto("/apps/app-1?market=pl");

  await expect(
    card(page, "Metadata coverage").getByText(
      "All markets, judged against the home listing",
    ),
  ).toBeVisible();
  await expect(card(page, "Category ranks · Home market")).toBeVisible();
});

test("links the keyword discoveries of the scoped market", async ({ page }) => {
  await page.goto("/apps/app-1");

  const coverage = card(page, "Metadata coverage");
  await expect(
    coverage.getByRole("link", {
      name: "11 keyword discoveries, 4 where you already rank",
    }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?tab=discovered");

  await pickMarket(page, POLAND);

  await expect(
    coverage.getByRole("link", {
      name: "2 keyword discoveries, 1 where you already rank",
    }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?tab=discovered&country=pl");
});
