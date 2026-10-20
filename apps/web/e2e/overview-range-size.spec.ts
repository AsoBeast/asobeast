import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const OVERVIEW = "/apps/app-1";
const REVIEWS = "/apps/app-1/reviews";
const SLOW_API_MS = "800";
const CHART_SIZE_WARNING = /width\(0\) and height\(0\) of chart/;

const RANGE_CARDS = [
  {
    path: OVERVIEW,
    label: "Visibility history",
    chart: "Search visibility over time",
    param: "range",
    endpoint: /\/apps\/app-1\/visibility-history\?/,
  },
  {
    path: OVERVIEW,
    label: "Rank distribution history",
    chart: "Tracked keywords by rank band",
    param: "distRange",
    endpoint: /\/apps\/app-1\/rank-distribution-history\?/,
  },
  {
    path: OVERVIEW,
    label: "Category ranks · Home market",
    chart: "Category chart position over time",
    param: "categoryRange",
    endpoint: /\/apps\/app-1\/category-ranks\?/,
  },
  {
    path: REVIEWS,
    label: "Ratings history",
    chart: "Average rating and review volume",
    param: "range",
    endpoint: /\/apps\/app-1\/ratings-history\?/,
  },
] as const;

const card = (page: Page, label: string) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) });

const nextPaint = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

for (const { path, label, chart, param, endpoint } of RANGE_CARDS) {
  test(`${label} stays measurable while the 90d range loads`, async ({
    page,
    context,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "warning" &&
        CHART_SIZE_WARNING.test(message.text())
      ) {
        warnings.push(message.text());
      }
    });
    await page.goto(path);
    const region = card(page, label).getByRole("region", { name: chart });
    await expect(region).toBeVisible();
    const tab = await hydrated(
      card(page, label).getByRole("tab", { name: "90d" }),
    );
    await seedCookies(context, { e2e_api_latency: SLOW_API_MS });
    const loaded = page.waitForResponse(endpoint);

    await tab.click();
    await loaded;

    await expect(page).toHaveURL(new RegExp(`${param}=90d`));
    await expect(region).toBeVisible();
    await nextPaint(page);
    expect(warnings).toEqual([]);
  });
}
