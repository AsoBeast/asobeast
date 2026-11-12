import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  PORTFOLIO,
  PORTFOLIO_VISIBILITY,
  portfolioRangeDeltasOf,
} from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { startedSetup } from "./setup-session.mts";

const CHECKED_APPS = PORTFOLIO.apps.filter(
  (app) => app.lastCapturedAt !== null,
).length;

const tile = (page: Page, label: string) =>
  page.locator('[data-slot="stat-tile"]').filter({ hasText: label });

const appsTable = (page: Page) =>
  page
    .getByRole("region", { name: "Apps", exact: true })
    .getByRole("table", { name: "Apps in this workspace" });

const chartLines = (page: Page) =>
  page.getByRole("list", { name: "Chart lines" }).getByRole("listitem");

test("a fresh install invites an import instead of showing an empty dashboard", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "portfolio_empty",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Track your first app", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="stat-tile"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Alerts", level: 2 }),
  ).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
});

test("the empty dashboard lists what an import delivers", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "portfolio_empty",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  const deliveries = page
    .getByRole("list", { name: "What you get" })
    .getByRole("listitem");
  await expect(deliveries).toHaveCount(3);
  await expect(deliveries.first()).toContainText("within minutes");
});

test("an app awaiting its first run says so instead of showing zeros", async ({
  page,
}) => {
  await page.goto("/?view=cards");

  const card = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByText("Pending App", { exact: true }) });

  await expect(card).toHaveCount(1);
  await expect(
    card.getByText(
      "Collecting the first positions. Visibility appears within the hour.",
    ),
  ).toBeVisible();
  await expect(card.getByText("0", { exact: true })).toHaveCount(0);
});

test("a table row awaiting its first run shows dashes instead of zeros", async ({
  page,
}) => {
  await page.goto("/");

  const row = appsTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "Pending App" }) });

  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell").nth(2)).toHaveText("—");
  await expect(row.getByText("0", { exact: true })).toHaveCount(0);
  await expect(row.getByText(/7d/)).toHaveCount(0);
});

test("an app in setup carries a progress chip that opens its setup", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/?view=cards");

  const card = (name: string) =>
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) });
  const chip = card("Focus Timer").getByRole("link", { name: "Setup 1 of 3" });

  await expect(chip).toHaveAttribute("href", "/apps/app-1/setup");
  expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(24);
  await expect(
    card("Habit Tracker").getByRole("link", { name: /^Setup / }),
  ).toHaveCount(0);
  await chip.click();
  await expect(page).toHaveURL("/apps/app-1/setup");
});

test("a table row in setup carries a progress link that opens its setup", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/");

  const links = appsTable(page).getByRole("link", { name: /^Setup / });

  await expect(links).toHaveCount(1);
  await expect(links).toHaveText("Setup 1 of 3");
  await expect(links).toHaveAttribute("href", "/apps/app-1/setup");
  await expect(
    appsTable(page)
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: /^Setup / }) })
      .getByRole("link", { name: "Focus Timer" }),
  ).toHaveAttribute("href", "/apps/app-1");
  expect((await links.boundingBox())?.height).toBeGreaterThanOrEqual(24);
  await links.click();
  await expect(page).toHaveURL("/apps/app-1/setup");
});

test("the sparkline end marker stays round however wide the card is", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=cards");

  const marker = page.locator('[data-slot="sparkline-end"]').first();
  await expect(marker).toBeVisible();

  const box = await marker.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  expect(box.height).toBeGreaterThan(0);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
});

test("an app card draws its trend as one line without a fill", async ({
  page,
}) => {
  await page.goto("/?view=cards");

  const trend = page
    .getByRole("img", { name: /^visibility, last 30 days/ })
    .first();
  await expect(trend).toBeVisible();
  await expect(trend.locator("path")).toHaveCount(1);
});

test("the summary tile numbers stay on one line when the strip narrows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.last()).toBeVisible();

  const offsets = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const value = node.querySelector(".numeric") as HTMLElement;
      return Math.round(
        value.getBoundingClientRect().top - node.getBoundingClientRect().top,
      );
    }),
  );

  expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThanOrEqual(1);
});

test("the summary tiles state the window they measure", async ({ page }) => {
  await page.goto("/");

  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles.locator(":scope > span:first-child")).toHaveText([
    "Visibility",
    "Keywords in top 10",
    "Moved in 30 days",
    "Open actions",
  ]);
  await expect(tiles.getByText(/^across \d+ apps$/)).toBeVisible();
  await expect(
    tiles.getByText(/^\d+ started ranking · \d+ dropped out$/),
  ).toBeVisible();
});

test("the visibility tile reads the portfolio figure and its change over the range", async ({
  page,
}) => {
  await page.goto("/");

  const { current } = PORTFOLIO_VISIBILITY;
  const month = portfolioRangeDeltasOf(30).visibility;
  const visibility = tile(page, "Visibility");
  await expect(visibility).toHaveCount(1);
  await expect(
    visibility.getByText(String(Math.round(current)), { exact: true }),
  ).toBeVisible();
  await expect(
    visibility.getByText(`+${Math.round(month)} 30d`, { exact: true }),
  ).toBeVisible();
  await expect(
    visibility.getByText(`across ${CHECKED_APPS} apps`, { exact: true }),
  ).toBeVisible();
});

test("one chart draws visibility across the apps against the previous period", async ({
  page,
}) => {
  await page.goto("/");

  const chart = page.getByRole("region", {
    name: "Visibility across your apps over the last 30 days",
  });
  await expect(chart).toBeVisible();
  await expect(chart.locator("svg.recharts-surface")).toBeVisible();
  await expect(chartLines(page)).toHaveText([
    "Last 30 days",
    "Previous 30 days",
  ]);
  await expect(
    page.getByRole("main").locator('[data-slot="chart"]'),
  ).toHaveCount(1);
});

test("a tile draws its own chart, writes the url and keeps the keyboard", async ({
  page,
}) => {
  await page.goto("/");

  const visibility = tile(page, "Visibility");
  const top10 = await hydrated(tile(page, "Keywords in top 10"));
  await expect(visibility).toHaveAttribute("aria-pressed", "true");
  await top10.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/[?&]metric=top10/);
  await expect(top10).toHaveAttribute("aria-pressed", "true");
  await expect(visibility).toHaveAttribute("aria-pressed", "false");
  await expect(top10).toBeFocused();
  await expect(
    page.getByRole("region", {
      name: "Keywords in the top 10 over the last 30 days",
    }),
  ).toBeVisible();

  await tile(page, "Moved in 30 days").click();
  await expect(page).toHaveURL(/[?&]metric=moved/);
  await expect(
    page.getByRole("region", {
      name: "Keywords that climbed and fell each day over the last 30 days",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Chart bars" }).getByRole("listitem"),
  ).toHaveText(["Climbed", "Fell"]);

  await tile(page, "Open actions").click();
  await expect(page).toHaveURL(/[?&]metric=actions/);
  await expect(
    page.getByText("Actions opened and closed each day", { exact: true }),
  ).toBeVisible();

  await visibility.click();
  await expect(page).not.toHaveURL(/metric=/);
  await expect(
    page.getByRole("main").locator('[data-slot="chart"]'),
  ).toHaveCount(1);
});

test("the range beside import app redraws the chart for the chosen days", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/portfolio/history")) {
      asked.push(url.searchParams.get("days") ?? "");
    }
  });
  await page.goto("/");

  const range = await hydrated(
    page.getByRole("combobox", { name: "Dashboard range, Last 30 days" }),
  );
  await range.click();
  await page.getByRole("option", { name: "Last 90 days" }).click();

  await expect(page).toHaveURL(/[?&]range=90/);
  await expect(chartLines(page)).toHaveText([
    "Last 90 days",
    "Previous 90 days",
  ]);
  await expect(
    page.getByRole("region", {
      name: "Visibility across your apps over the last 90 days",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Dashboard range, Last 90 days" }),
  ).toBeFocused();
  expect(asked).toContain("90");
  await expect(tile(page, "Moved in 90 days")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText(
    `+${Math.round(portfolioRangeDeltasOf(90).visibility)} 90d`,
  );
  expect(portfolioRangeDeltasOf(90).visibility).not.toBe(
    portfolioRangeDeltasOf(30).visibility,
  );
  await expect(page.getByRole("main")).toContainText("In the last 90 days");
  await expect(page.getByRole("main")).toContainText(
    "Largest position changes in the last 90 days",
  );

  await page.reload();
  await expect(chartLines(page).first()).toHaveText("Last 90 days");
});

test("a link with a metric and a range opens that chart", async ({ page }) => {
  await page.goto("/?metric=top10&range=7");

  await expect(tile(page, "Keywords in top 10")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("region", {
      name: "Keywords in the top 10 over the last 7 days",
    }),
  ).toBeVisible();
  await expect(chartLines(page)).toHaveText(["Last 7 days", "Previous 7 days"]);
});

test("the chart marks today as still checking while the daily run is in progress", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e_run_running",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  await expect(chartLines(page)).toHaveText([
    "Last 30 days",
    "Still checking",
    "Previous 30 days",
  ]);
});

test("the open actions tile says so when no action set has been generated", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e_actions_ungenerated",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  const actions = tile(page, "Open actions");
  await expect(actions).toHaveCount(1);
  await expect(actions).toContainText("—");
  await expect(actions).toContainText("Not generated yet");
});

const middleOf = async (target: Locator): Promise<number> => {
  const box = await target.boundingBox();
  if (box === null) throw new Error("The element has no layout box");
  return box.y + box.height / 2;
};

const trendOffset = async (value: Locator): Promise<number> => {
  const parts = value.locator(":scope > span > span");
  return Math.abs(
    (await middleOf(parts.first())) - (await middleOf(parts.last())),
  );
};

test("the top 10 trend sits level with its figure", async ({ page }) => {
  await page.goto("/");

  const value = tile(page, "Keywords in top 10")
    .locator(":scope > span")
    .nth(1);
  await expect(value).toContainText("30d");

  expect(await trendOffset(value)).toBeLessThanOrEqual(2);
});

test("the visibility trend sits level with its figure", async ({ page }) => {
  await page.goto("/");

  const value = tile(page, "Visibility").locator(":scope > span").nth(1);
  await expect(value).toContainText("30d");

  expect(await trendOffset(value)).toBeLessThanOrEqual(2);
});
