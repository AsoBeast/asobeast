import type { Page } from "@playwright/test";
import type { PortfolioSummary } from "@asobeast/shared";
import { expect, test } from "./session.mts";

const statusLine = (page: Page) =>
  page.locator('[data-slot="portfolio-status"]');

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
