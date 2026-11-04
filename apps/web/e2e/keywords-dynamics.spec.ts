import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { PL_HISTORY_COOKIE, utcDaysAgo } from "./fixtures.mts";
import { seedCookies } from "./routes.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

const PANEL = "Keyword dynamics";
const CHART = "Keyword rank positions";
const SERIES = "Charted series";

test.afterEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords/app-1`, {
    failOnStatusCode: true,
  });
  await request.post(`${MOCK_API_URL}/__reset/keywords/app-bulk`, {
    failOnStatusCode: true,
  });
});

const chartSeries = (page: Page) =>
  page
    .getByRole("region", { name: CHART })
    .getByRole("list", { name: SERIES })
    .getByRole("listitem");

async function openDynamics(page: Page, names: string[]) {
  await page.goto("/apps/app-1/keywords");
  for (const name of names) {
    await page.getByRole("checkbox", { name: `Select ${name}` }).check();
  }
  await page.getByRole("button", { name: "Show dynamics" }).click();
  const panel = page.getByRole("region", { name: PANEL });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("region", { name: CHART })).toBeVisible();
  return panel;
}

test("the bulk bar opens the dynamics panel between the toolbar and the table", async ({
  page,
}) => {
  await openDynamics(page, ["focus timer", "pomodoro"]);

  await expect(chartSeries(page)).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
  ]);
  await expect(page).toHaveURL(/keywords=kw-1,kw-2/);
  await expect(page).not.toHaveURL(/range=/);

  await expect(page.getByRole("heading", { name: PANEL })).toBeFocused();

  const panelBox = await page
    .getByRole("region", { name: PANEL })
    .boundingBox();
  const tableBox = await page
    .getByRole("table", { name: /Tracked keywords/ })
    .boundingBox();
  const pillsBox = await page
    .getByRole("group", { name: "Keyword markets" })
    .boundingBox();
  expect(panelBox).not.toBeNull();
  expect(tableBox).not.toBeNull();
  expect(pillsBox).not.toBeNull();
  if (!panelBox || !tableBox || !pillsBox) throw new Error("missing layout");
  expect(panelBox.y).toBeGreaterThan(pillsBox.y);
  expect(panelBox.y).toBeLessThan(tableBox.y);
});

test("a range preset writes to the url and re-keys the chart read", async ({
  page,
}) => {
  const panel = await openDynamics(page, ["focus timer"]);

  const request = page.waitForRequest(
    /\/api\/backend\/apps\/app-1\/rankings\?/,
  );
  await panel.getByRole("tab", { name: "7d" }).click();

  expect(new URL((await request).url()).searchParams.get("from")).toBe(
    utcDaysAgo(7),
  );
  await expect(page).toHaveURL(/range=7d/);
  await expect(chartSeries(page)).toHaveText(["focus timer (US)"]);
});

test("the bulk bar refuses to chart more than eight keywords", async ({
  page,
}) => {
  await page.goto("/apps/app-bulk/keywords");
  const checkboxes = page.getByRole("checkbox", {
    name: /^Select bulk keyword/,
  });
  for (let index = 0; index < 10; index += 1) {
    await checkboxes.nth(index).check();
  }
  const dynamics = page.getByRole("button", { name: "Show dynamics" });
  await expect(page.getByText("10 selected")).toBeVisible();
  await expect(dynamics).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Select 8 or fewer keywords to chart."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).not.toHaveAttribute("aria-disabled");

  for (let index = 0; index < 2; index += 1) {
    await checkboxes.nth(index).uncheck();
  }
  await expect(dynamics).not.toHaveAttribute("aria-disabled");
  await expect(
    page.getByText("Select 8 or fewer keywords to chart."),
  ).toHaveCount(0);

  await dynamics.click();
  await expect(page.getByRole("region", { name: PANEL })).toBeVisible();
  await expect(page.getByText("Charting 8 of 8 keywords.")).toHaveCount(0);
});

test("removing a chip keeps the line out of the chart and the url", async ({
  page,
}) => {
  await openDynamics(page, ["focus timer", "pomodoro"]);

  await page
    .getByRole("button", { name: "Remove focus timer (US) from the chart" })
    .click();

  await expect(page).toHaveURL(/keywords=kw-2/);
  await expect(chartSeries(page)).toHaveText(["pomodoro (US)"]);
  await expect(
    page.getByRole("button", { name: "Remove pomodoro (US) from the chart" }),
  ).toBeFocused();
});

test("removing the last chip and Clear close the panel and clean the url", async ({
  page,
}) => {
  const panel = await openDynamics(page, ["focus timer", "pomodoro"]);

  await page
    .getByRole("button", { name: "Remove focus timer (US) from the chart" })
    .click();
  await page
    .getByRole("button", { name: "Remove pomodoro (US) from the chart" })
    .click();

  await expect(panel).toHaveCount(0);
  await expect(page).not.toHaveURL(/keywords=/);
  await expect(page).not.toHaveURL(/range=/);
  await expect(
    page.getByRole("button", { name: "Show dynamics" }),
  ).toBeFocused();

  await page.getByRole("checkbox", { name: "Select focus timer" }).check();
  await page.getByRole("button", { name: "Show dynamics" }).click();
  await page
    .getByRole("region", { name: PANEL })
    .getByRole("tab", { name: "7d" })
    .click();
  await expect(page).toHaveURL(/range=7d/);
  await page
    .getByRole("region", { name: PANEL })
    .getByRole("button", { name: "Clear", exact: true })
    .click();

  await expect(page.getByRole("region", { name: PANEL })).toHaveCount(0);
  await expect(page).not.toHaveURL(/keywords=/);
  await expect(page).not.toHaveURL(/range=/);
});

test("table sorting, filtering and bulk actions leave an open chart alone", async ({
  page,
}) => {
  await openDynamics(page, ["focus timer", "pomodoro"]);

  await page.getByRole("button", { name: "Popularity", exact: true }).click();
  await expect(page).toHaveURL(/sort=traffic/);
  await page.getByRole("checkbox", { name: "Select focus timer" }).uncheck();
  await expect(page.getByText("1 selected")).toBeVisible();
  await expect(page).toHaveURL(/keywords=kw-1,kw-2/);
  await expect(chartSeries(page)).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
  ]);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("row", { name: /pomodoro/ }).getByText("Paused"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/keywords=kw-1,kw-2/);
  await expect(chartSeries(page)).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
  ]);
});

test("the market pills scope the chart and its change markers", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [PL_HISTORY_COOKIE]: "1" });
  const changeRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/backend\/apps\/app-1\/changes\?/.test(request.url())) {
      changeRequests.push(request.url());
    }
  });

  await openDynamics(page, ["focus timer", "pomodoro"]);
  const chart = page.getByRole("region", { name: CHART });
  await expect(chart.locator(".metadata-change-marker")).toHaveCount(3);

  await page
    .getByRole("group", { name: "Keyword markets" })
    .getByRole("button", { name: /^PL/ })
    .click();
  await expect(page).toHaveURL(/country=pl/);
  await expect(chartSeries(page)).toHaveText(["minutnik skupienia (PL)"]);
  await expect(chart.locator(".metadata-change-marker")).toHaveCount(3);
  await expect
    .poll(() => (changeRequests.at(-1) ?? "").includes("country=pl"))
    .toBe(true);
});

test("a shared link paints the panel with its range at first render", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?keywords=kw-1,kw-3&range=7d");

  await expect(page.getByRole("region", { name: PANEL })).toBeVisible();
  await expect(chartSeries(page)).toHaveText([
    "focus timer (US)",
    "study timer (US)",
  ]);
  await expect(
    page.getByRole("region", { name: PANEL }).getByRole("tab", { name: "7d" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("stale ids in a shared link fall back to the market's top keywords", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?keywords=kw-gone");

  await expect(chartSeries(page)).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
    "study timer (US)",
    "productivity app (US)",
    "time blocking (US)",
  ]);
});

test("an empty market tells the panel so", async ({ page }) => {
  await page.goto("/apps/app-1/keywords?keywords=kw-1&country=gb");

  await expect(
    page
      .getByRole("region", { name: PANEL })
      .getByText("No keywords tracked in United Kingdom yet"),
  ).toBeVisible();
});
