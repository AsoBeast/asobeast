import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { TOP_CHART_APPS, TOP_CHART_DATES, utcDaysAgo } from "./fixtures.mts";

const formatDayMonth = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const chartTable = (page: Page) => page.getByRole("table");

const pick = async (page: Page, control: string, option: string) => {
  await page.getByRole("combobox", { name: control }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("renders the chart for the default filters", async ({ page }) => {
  await page.goto("/charts");

  await expect(
    page.getByRole("heading", { level: 1, name: "Top charts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Store" }).getByRole("tab", {
      name: "App Store",
    }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "Country" })).toHaveText(
    "US · United States",
  );
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
  const rows = chartTable(page).locator("tbody tr");
  await expect(rows).toHaveCount(TOP_CHART_APPS.length);
  const first = rows.first();
  await expect(first.getByRole("cell").first()).toHaveText("1");
  await expect(first).toContainText(TOP_CHART_APPS[0].title);
  await expect(first).toContainText(TOP_CHART_APPS[0].developer ?? "");
});

test("keeps every filter in the url", async ({ page }) => {
  await page.goto("/charts");

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "Google Play" })
    .click();
  await pick(page, "Country", "DE · Germany");
  await pick(page, "Category", "Puzzle");
  await page
    .getByRole("tablist", { name: "Chart" })
    .getByRole("tab", { name: "Grossing" })
    .click();

  await expect(page).toHaveURL(/store=GOOGLE_PLAY/);
  await expect(page).toHaveURL(/country=de/);
  await expect(page).toHaveURL(/genre=GAME_PUZZLE/);
  await expect(page).toHaveURL(/collection=grossing/);
  await expect(page.getByRole("combobox", { name: "Device" })).toHaveCount(0);

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "App Store" })
    .click();

  await expect(page).not.toHaveURL(/genre=/);
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
  const device = page.getByRole("combobox", { name: "Device" });
  await expect(device).toHaveText("iPhone");
  await device.click();
  await expect(
    page.getByRole("option", { name: "iPad · not captured yet" }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("picks a captured day", async ({ page }) => {
  await page.goto("/charts");
  const oldest = TOP_CHART_DATES.at(-1) ?? "";
  const newest = TOP_CHART_DATES[0];

  await page.getByRole("button", { name: "Captured day", exact: true }).click();
  await expect(
    page.getByRole("button", { name: formatDay(newest) }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: formatDay(utcDaysAgo(4)) }),
  ).toBeDisabled();
  if (oldest.slice(0, 7) !== newest.slice(0, 7)) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
  await page.getByRole("button", { name: formatDay(oldest) }).click();

  await expect(page).toHaveURL(new RegExp(`date=${oldest}`));
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(oldest),
  );

  await page.getByRole("button", { name: "Next captured day" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${TOP_CHART_DATES.at(-2)}`));

  await page.goto(`/charts?date=${newest}`);
  await expect(
    page.getByRole("button", { name: "Next captured day" }),
  ).toBeDisabled();
});

test("shows the empty day and the uncaptured chart", async ({
  page,
  context,
}) => {
  await page.goto(`/charts?date=${utcDaysAgo(4)}`);
  await expect(
    page.getByText(`No capture of this chart on ${formatDay(utcDaysAgo(4))}`),
  ).toBeVisible();

  await context.addCookies([
    {
      name: "e2e_chart_uncaptured",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts");
  await expect(
    page.getByText("This chart has not been captured yet"),
  ).toBeVisible();
});

test("filters the rows in the browser", async ({ page }) => {
  await page.goto("/charts");

  await page
    .getByRole("textbox", { name: "Search apps" })
    .fill(TOP_CHART_APPS[2].title);

  await expect(chartTable(page).locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText(/1\s+of\s+10\s+apps/)).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(chartTable(page).locator("tbody tr")).toHaveCount(10);
});

test("is reachable from the sidebar and the palette", async ({ page }) => {
  await page.goto("/");

  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Top charts" });
  await link.click();
  await expect(page).toHaveURL(/\/charts$/);
  await expect(link).toHaveAttribute("aria-current", "page");

  await page.goto("/settings");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: "Top charts" }).click();
  await expect(page).toHaveURL(/\/charts$/);
});

test("shows each row's movement", async ({ page }) => {
  await page.goto("/charts");
  const rows = chartTable(page).locator("tbody tr");

  await expect(rows.nth(0)).toContainText("Up 2 from #3");
  await expect(rows.nth(0).locator("svg.lucide-arrow-up")).toBeVisible();
  await expect(rows.nth(1)).toContainText("Down 1 from #1");
  await expect(rows.nth(2)).toContainText("No change");
  await expect(rows.nth(3).getByText("New", { exact: true })).toBeVisible();
});

test("compares against the chosen window", async ({ page }) => {
  await page.goto("/charts");
  const request = page.waitForRequest(/\/charts\?.*compare=7d/);

  await pick(page, "Filter by compare", "vs 7 days ago");

  await expect(page).toHaveURL(/compare=7d/);
  await request;
  await expect(
    page.getByText(`vs ${formatDayMonth(TOP_CHART_DATES[1])}`, { exact: true }),
  ).toBeVisible();
});

test("lists the trending apps", async ({ page }) => {
  await page.goto("/charts");
  const trending = page.getByRole("tablist", { name: "Trending list" });

  await expect(trending.getByRole("tab", { name: /Climbers/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  await expect(panel).toContainText(TOP_CHART_APPS[7].title);

  await trending.getByRole("tab", { name: /Dropped out/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Was #4");

  await page.goto("/charts?compare=30d");
  await expect(
    page.getByText("Capture more days to see movement."),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Trending list" }),
  ).toHaveCount(0);
});

test("sorts by movement", async ({ page }) => {
  await page.goto("/charts");

  await page.getByRole("button", { name: "Change" }).click();

  await expect(page).toHaveURL(/sort=movement/);
  await expect(chartTable(page).locator("tbody tr").first()).toContainText(
    "New entry",
  );
});

const MOCK_API = "http://localhost:4100";

test("captures today", async ({ page, request }) => {
  await page.goto(`/charts?date=${TOP_CHART_DATES[2]}`);

  await page.getByRole("button", { name: "Capture today" }).click();

  await expect(page.getByText("Captured today's chart")).toBeVisible();
  await expect(page).not.toHaveURL(/date=/);
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(utcDaysAgo(0)),
  );
  await expect(page.getByRole("button", { name: "Capture today" })).toHaveCount(
    0,
  );
  const captures = (await (
    await request.get(`${MOCK_API}/__chart-captures`)
  ).json()) as Array<Record<string, string>>;
  expect(captures.at(-1)).toEqual({
    store: "APP_STORE",
    country: "us",
    collection: "free",
    genre: "overall",
    device: "iphone",
  });
});

test("offers a capture only when the api has no capture for its day", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "e2e_chart_api_day",
      value: TOP_CHART_DATES[0],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts");

  await expect(
    page.getByRole("button", { name: "Follow chart" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture today" })).toHaveCount(
    0,
  );
});

test("a spent allowance is shown", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "e2e_chart_capture_spent",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts");

  await page.getByRole("button", { name: "Capture today" }).click();

  await expect(page.getByText(/Chart capture limit reached/)).toBeVisible();
});

test("follows and unfollows", async ({ page, request }) => {
  await request.get(`${MOCK_API}/__reset-chart-follows`);
  await page.goto("/charts?genre=7012");

  await page.getByRole("button", { name: "Follow chart" }).click();

  await expect(page.getByText(/^Following Top free · Puzzle/)).toBeVisible();
  const follows = async () =>
    (await (await request.get(`${MOCK_API}/__chart-follows`)).json()) as Array<
      Record<string, string>
    >;
  expect((await follows()).map((follow) => follow.genre)).toEqual(["7012"]);

  await page.getByRole("button", { name: "Following" }).click();
  await page.getByRole("button", { name: "Stop following" }).click();

  await expect(page.getByText("Stopped following")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Follow chart" }),
  ).toBeVisible();
  expect(await follows()).toEqual([]);
});

test("badges the workspace's apps", async ({ page }) => {
  await page.goto("/charts");
  const rows = chartTable(page).locator("tbody tr");

  await expect(
    rows.nth(2).getByRole("link", { name: "Yours" }),
  ).toHaveAttribute("href", "/apps/app-1");
  await expect(
    rows.nth(4).getByRole("link", { name: "Competitor of Focus Timer" }),
  ).toHaveAttribute("href", "/apps/app-1/competitors");
  await expect(rows.nth(2).getByRole("combobox")).toHaveCount(0);
  await expect(rows.nth(4).getByRole("combobox")).toHaveCount(0);
});

test("adds a row as a competitor", async ({ page, request }) => {
  await page.goto("/charts");
  const row = TOP_CHART_APPS[0];
  const posted = page.waitForRequest(
    (sent) =>
      sent.method() === "POST" &&
      sent.url().endsWith("/apps/app-1/competitors"),
  );

  await pick(page, `Add ${row.title} as competitor to`, "Focus Timer");

  expect((await posted).postDataJSON()).toEqual({ url: row.storeAppId });
  await expect(page.getByText(/^Now tracking/)).toBeVisible();
  await request.post(`${MOCK_API}/__reset/competitors/app-1`);
});

test("opens the store", async ({ page }) => {
  await page.goto("/charts");

  await expect(
    page.getByRole("link", {
      name: `Open ${TOP_CHART_APPS[0].title} in the store`,
    }),
  ).toHaveAttribute(
    "href",
    `https://apps.apple.com/us/app/id${TOP_CHART_APPS[0].storeAppId}`,
  );
});
