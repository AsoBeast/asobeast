import type { Page, Request } from "@playwright/test";
import { expect, test } from "./session.mts";

const visibilityCard = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ hasText: /^Visibility/ })
    .first();

const chartCard = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("tablist", { name: "Chart view" }) });

const comparedHistory = (request: Request) =>
  /\/visibility-history\?/.test(request.url()) &&
  new URL(request.url()).searchParams.get("compare") === "competitors";

test("states the share of voice on the visibility card", async ({ page }) => {
  await page.goto("/apps/app-1");
  const card = visibilityCard(page);

  await expect(card).toContainText("Share of voice42.0%");
  await expect(card).toContainText("+3.5 7d");
  await expect(card).toContainText("vs 1 competitor");
  await expect(card).toContainText("Non branded51.3%");
  await expect(card).toContainText("-1.2 7d");

  await card.getByRole("button", { name: "About share of voice" }).click();
  const popover = page.getByRole("dialog", {
    name: "How share of voice is calculated",
  });
  await expect(popover).toContainText("42.0%");
  await expect(popover).toContainText("49.3%");
  await expect(
    popover.getByRole("link", { name: "Read how share of voice is counted" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/docs\.asobeast\.com\/concepts\/visibility(#share-of-voice)?$/,
  );
});

test("says why a market has no share of voice", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await expect(visibilityCard(page)).toContainText(
    "Your competitors have not been checked yet",
  );
  await expect(visibilityCard(page)).not.toContainText("Non branded");
});

test("asks for a competitor when the app has none", async ({ page }) => {
  await page.goto("/apps/app-2");

  await expect(visibilityCard(page)).toContainText(
    "Add a competitor to see your share of voice",
  );
});

test("switches the chart to share of voice and keeps it in the url", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    if (/visibility-history/.test(request.url())) asked.push(request.url());
  });
  await page.goto("/apps/app-1");
  await page.waitForLoadState("networkidle");
  expect(asked.some((url) => url.includes("compare="))).toBe(false);

  const compared = page.waitForRequest(comparedHistory);
  await chartCard(page).getByRole("tab", { name: "Share of voice" }).click();
  await compared;

  await expect(page).toHaveURL(/[?&]visView=share/);
  const chart = page.getByRole("region", { name: "Share of voice over time" });
  await expect(chart).toBeVisible();
  const legend = chartCard(page).getByRole("list", { name: "Charted series" });
  await expect(legend).toContainText("Share of voice");
  await expect(legend).toContainText("Non branded");
  await expect(chart.locator(".recharts-line")).toHaveCount(2);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Share of voice over time" }),
  ).toBeVisible();

  await chartCard(page).getByRole("tab", { name: "90d" }).click();
  await expect(page).toHaveURL(/range=90d/);
  await expect(
    page.getByRole("region", { name: "Share of voice over time" }),
  ).toBeVisible();

  await chartCard(page).getByRole("tab", { name: "Visibility" }).click();
  await expect(page).not.toHaveURL(/visView=/);
  await expect(
    page.getByRole("region", { name: "Search visibility over time" }),
  ).toBeVisible();
});

test("keeps the previous chart on screen while the next view loads", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/width\(0\) and height\(0\)/.test(message.text())) {
      warnings.push(message.text());
    }
  });
  await page.route(
    "**/visibility-history?*compare=competitors*",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    },
  );
  await page.goto("/apps/app-1");
  const visibility = page.getByRole("region", {
    name: "Search visibility over time",
  });
  await expect(visibility).toBeVisible();

  await chartCard(page).getByRole("tab", { name: "Share of voice" }).click();
  await expect(visibility).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Share of voice over time" }),
  ).toBeVisible();
  expect(warnings).toEqual([]);
});

test("asks for a competitor on the chart of an app without one", async ({
  page,
}) => {
  await page.goto("/apps/app-2?visView=share");

  await expect(chartCard(page)).toContainText(
    "Add a competitor to chart share of voice",
  );
});

test("names the share of each line in the tooltip", async ({ page }) => {
  await page.goto("/apps/app-1?visView=share");
  const chart = page.getByRole("region", { name: "Share of voice over time" });
  await expect(chart).toBeVisible();

  const plot = chart.getByRole("application");
  await plot.focus();

  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Share of voice");
  await expect(tooltip).toContainText("Non branded");
  await expect(tooltip).toContainText("vs 1 competitor");
  await expect(tooltip).toContainText("%");
});

for (const width of [320, 375]) {
  test(`fits the chart toggle on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/apps/app-1?visView=share");
    await expect(
      chartCard(page).getByRole("tablist", { name: "Chart view" }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
}
