import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";
import { startedSetup } from "./setup-session.mts";

const STRUCTURAL_RULES = [
  "aria-valid-attr-value",
  "aria-prohibited-attr",
  "empty-table-header",
];

const violationsOf = async (page: Page, rules: string[]) => {
  const { violations } = await new AxeBuilder({ page })
    .withRules(rules)
    .analyze();
  return violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((node) => node.target.join(" ")),
  }));
};

const structuralViolations = (page: Page) =>
  violationsOf(page, STRUCTURAL_RULES);

const scrollViolations = (page: Page) =>
  violationsOf(page, ["scrollable-region-focusable"]);

for (const path of [
  "/",
  "/actions",
  "/apps/app-1",
  "/apps/app-1/changes",
  "/apps/app-1/rankings",
  "/apps/app-1/reviews",
  "/apps/app-1/keywords",
  "/apps/app-floor/keywords",
  "/apps/app-1/competitors",
  "/settings",
  "/integrations",
]) {
  test(`${path} names every range tab, star rating and table header`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(await structuralViolations(page)).toEqual([]);
  });
}

test("the competitors page with every section collapsed names no missing control", async ({
  page,
  context,
}) => {
  await seedCookies(context, {
    asobeast_collapsed:
      "competitors.tracked%2Ccompetitors.discovery%2Ccompetitors.matrix",
  });
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  expect(await structuralViolations(page)).toEqual([]);
});

test("/apps/app-1/setup names the panel of every picker tab", async ({
  page,
  context,
}) => {
  await startedSetup(context, "app-1");
  await page.goto("/apps/app-1/setup");
  await expect(
    page.getByRole("tab", { name: "From your listing" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.waitForLoadState("networkidle");

  expect(await structuralViolations(page)).toEqual([]);
});

test("the import dialog names the panel of every store tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import app" }).click();
  const dialog = page.getByRole("dialog", { name: "Import an app" });
  await expect(dialog.getByRole("tab")).toHaveCount(2);

  expect(await structuralViolations(page)).toEqual([]);
});

const SCROLLING_TABLES: Array<{
  path: string;
  table: string;
  region: string;
  cookies?: Record<string, string>;
}> = [
  {
    path: "/apps/app-1/audit",
    table: "How your listing compares with 3 competitors",
    region: "Competitor comparison",
  },
  {
    path: "/apps/app-1/metadata",
    table: "Which of your markets read each localization",
    region: "Localization matrix",
  },
  {
    path: "/apps/app-1",
    table:
      "Rating and number of ratings on the newest listing captured in each market",
    region: "Market ratings table",
    cookies: { e2e_ratings_markets: "wide" },
  },
];

const containerOf = (page: Page, table: string) =>
  page
    .locator('[data-slot="table-container"]')
    .filter({ has: page.getByRole("table", { name: table }) });

for (const { path, table, region, cookies } of SCROLLING_TABLES) {
  test(`${path} lets a keyboard scroll its table at 375px`, async ({
    page,
    context,
  }) => {
    if (cookies) await seedCookies(context, cookies);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const container = containerOf(page, table);
    await expect(container).toBeVisible();
    expect(
      await container.evaluate((node) => node.scrollWidth > node.clientWidth),
    ).toBe(true);

    await expect.poll(() => scrollViolations(page)).toEqual([]);

    const scroller = page.getByRole("region", { name: region });
    await scroller.focus();
    await page.keyboard.press("ArrowRight");
    await expect(scroller).toBeFocused();
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
  });

  test(`${path} adds no tab stop while its table fits at 1440px`, async ({
    page,
    context,
  }) => {
    if (cookies) await seedCookies(context, cookies);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const container = containerOf(page, table);
    await expect(container).toBeVisible();
    expect(
      await container.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);

    await expect(page.getByRole("region", { name: region })).toHaveCount(0);
    expect(await scrollViolations(page)).toEqual([]);
  });
}
