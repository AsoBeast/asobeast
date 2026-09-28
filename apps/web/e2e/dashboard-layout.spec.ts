import type { Page } from "@playwright/test";
import type { PortfolioSummary } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { PORTFOLIO_INSIGHTS } from "./portfolio-insights.mts";

const statusLine = (page: Page) =>
  page.locator('[data-slot="portfolio-status"]');

const tileBoxes = async (page: Page) => {
  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.last()).toBeVisible();
  return tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
};

const mainHeadings = (page: Page) =>
  page.getByRole("main").getByRole("heading");

test("the dashboard outline reads in visual order on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(mainHeadings(page)).toHaveText([
    "Dashboard",
    "Top actions",
    "Keyword movers",
    "Apps",
    "Recent changes",
  ]);
});

test("apps and recent changes share a row once the sidebar collapses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
    "data-state",
    "collapsed",
  );

  const apps = page.getByRole("region", { name: "Apps" });
  const changes = page
    .getByRole("heading", { name: "Recent changes", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

  await expect(async () => {
    const appsBox = (await apps.boundingBox())!;
    const changesBox = (await changes.boundingBox())!;
    expect(changesBox.x).toBeGreaterThanOrEqual(appsBox.x + appsBox.width);
    expect(changesBox.y).toBeLessThan(appsBox.y + appsBox.height);
    expect(appsBox.y).toBeLessThan(changesBox.y + changesBox.height);
  }).toPass();
});

test("the header states what the dashboard covers", async ({ page }) => {
  await page.goto("/");

  const { totals } = (await page.request
    .get("/api/backend/portfolio")
    .then((response) => response.json())) as PortfolioSummary;
  await expect(statusLine(page)).toContainText(
    `${totals.apps} apps · ${totals.trackedKeywords} keywords · ${totals.competitors} competitors`,
  );
  await expect(statusLine(page)).toContainText("Collected");
  await expect(statusLine(page)).toContainText("Daily run complete");
});

test("the header links the request budget to settings", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: /of the daily request budget/ }),
  ).toHaveAttribute("href", "/settings");
});

test("the first run page has no status line", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: "portfolio_empty", value: "1", url: "http://localhost:3000" },
    ]);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Track your first app", level: 1 }),
  ).toBeVisible();
  await expect(statusLine(page)).toHaveCount(0);
});

test("the pulse tiles form two rows of two on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const [first, second, third, fourth] = await tileBoxes(page);
  expect(Math.round(second.y)).toBe(Math.round(first.y));
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.y).toBeGreaterThanOrEqual(first.y + first.height);
  expect(Math.round(third.x)).toBe(Math.round(first.x));
  expect(Math.round(fourth.y)).toBe(Math.round(third.y));
});

test("the pulse tiles share one row on a desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const boxes = await tileBoxes(page);
  const tops = new Set(boxes.map((box) => Math.round(box.y)));
  expect(tops.size).toBe(1);
});

test("the movement tile reads its counts aloud", async ({ page }) => {
  await page.goto("/");

  const { up, down } = PORTFOLIO_INSIGHTS.totals.movement;
  const tile = page
    .locator('[data-slot="stat-tile"]')
    .filter({ hasText: "Keyword movement" });
  await expect(tile).toContainText(`${up} climbing, ${down} falling`);
});
