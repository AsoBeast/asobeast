import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";
import { utcDaysAgo } from "./fixtures.mts";
import {
  RANKINGS_EDGE_COOKIE,
  RTL_ENTRANT_KEYWORD,
} from "./rankings-fixtures.mts";
import { formatDayMonth } from "../src/lib/format";

const chartedKeywords = (page: Page) =>
  page
    .getByRole("table", { name: /^Charted keywords/ })
    .locator("tbody tr bdi");

const marketSelect = (page: Page) =>
  page.getByRole("combobox", { name: "Report markets" });

async function chooseMarket(page: Page, option: string) {
  await marketSelect(page).click();
  await page.getByRole("option", { name: option }).click();
}

test("rankings page renders the chart and filters series through the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  await expect(chart).toBeVisible();
  await expect(chartedKeywords(page)).toHaveText([
    "focus timer",
    "pomodoro",
    "study timer",
    "productivity app",
    "time blocking",
  ]);

  await expect(page.getByRole("button", { name: "5 selected" })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove focus timer (US) from the chart" })
    .click();

  await expect(page).toHaveURL(/keywords=/);
  await expect(page.getByRole("button", { name: "4 selected" })).toBeVisible();
});

test("a range preset writes to the url", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page
    .getByRole("tablist", { name: "Date range" })
    .getByRole("tab", { name: "7d" })
    .click();

  await expect(page).toHaveURL(/range=7d/);
});

test("the market select scopes the report to one storefront", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await expect(marketSelect(page)).toHaveText("All markets5");
  await expect(page.getByText("5 keywords in all markets.")).toBeVisible();

  await chooseMarket(page, "United States 5");
  await expect(page).toHaveURL(/country=us/);
  await expect(marketSelect(page)).toHaveText("United States5");
  await expect(marketSelect(page)).toBeFocused();
  await expect(page.getByText("5 keywords in United States.")).toBeVisible();
  await expect(page.getByRole("button", { name: "5 selected" })).toBeVisible();
  await expect(chartedKeywords(page)).toHaveText([
    "focus timer",
    "pomodoro",
    "study timer",
    "productivity app",
    "time blocking",
  ]);

  await chooseMarket(page, "Poland 0");
  await expect(page).toHaveURL(/country=pl/);
  await expect(
    page.getByText("No keywords tracked in Poland yet"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export CSV of rankings" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy image of the rankings chart" }),
  ).toHaveCount(0);

  await chooseMarket(page, "All markets 5");
  await expect(page).not.toHaveURL(/country=/);
  await expect(
    page.getByRole("button", { name: "Export CSV of rankings" }),
  ).toBeEnabled();
});

test("the lede says what moved and who entered the top 10", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const lede = page.locator("p", { hasText: "5 keywords in all markets." });
  await expect(lede).toContainText("since yesterday.");
  await expect(lede).toContainText(
    "3 apps entered your top 10 in the last 7 days.",
  );
});

test("the key table reads each charted keyword across the range", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const table = page.getByRole("table", { name: /^Charted keywords/ });
  await expect(
    table.getByRole("columnheader").filter({ hasText: /\S/ }),
  ).toHaveText([
    "Keyword",
    "Position",
    "30d change",
    "Best",
    "Average",
    "Remove",
  ]);

  const focus = table.getByRole("row", { name: /focus timer/ });
  await expect(focus.getByRole("cell").nth(1)).toHaveText("#3");
  await expect(
    focus.getByRole("img", { name: "up 7 in the last 30 days" }),
  ).toBeVisible();
  await expect(focus.getByRole("cell").nth(3)).toHaveText("#3");
  await expect(focus.getByRole("cell").nth(4)).toHaveText("#6");

  const stopped = table.getByRole("row", { name: /study timer/ });
  await expect(stopped.getByRole("cell").nth(1)).toContainText("#7");
  await expect(stopped.getByRole("cell").nth(1)).toContainText(
    `last checked ${formatDayMonth(utcDaysAgo(3))}`,
  );

  const unranked = table.getByRole("row", { name: /productivity app/ });
  await expect(unranked.getByRole("cell").nth(1)).toHaveText(">200");
  await expect(unranked.getByRole("cell").nth(2)).toHaveText("Not ranked");
});

test("removing a keyword hands focus to the next row", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page
    .getByRole("button", { name: "Remove focus timer (US) from the chart" })
    .press("Enter");

  await expect(page.getByRole("button", { name: "4 selected" })).toBeVisible();
  await expect(chartedKeywords(page)).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Remove pomodoro (US) from the chart" }),
  ).toBeFocused();
});

test("the by day view lists every checked day, newest first", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await page
    .getByRole("tablist", { name: "Positions view" })
    .getByRole("tab", { name: "By day" })
    .click();
  await expect(page).toHaveURL(/view=days/);
  await expect(
    page.getByRole("tab", { name: "By day", selected: true }),
  ).toBeFocused();

  const grid = page.getByRole("table", { name: /^The position of each/ });
  await expect(grid.getByRole("columnheader")).toHaveText([
    "Keyword",
    ...[0, 1, 2, 3, 4, 6, 7].map((daysAgo) =>
      formatDayMonth(utcDaysAgo(daysAgo)),
    ),
  ]);
  await expect(
    grid.getByRole("row", { name: /focus timer/ }).getByRole("cell"),
  ).toHaveText(["3", "5", "5", "6", "7", "9", "10"]);
  await expect(
    grid.getByRole("row", { name: /study timer/ }).getByRole("cell"),
  ).toHaveText([
    "–Not checked",
    "–Not checked",
    "–Not checked",
    "7",
    "7",
    "7",
    "7",
  ]);
  await expect(
    grid.getByRole("row", { name: /productivity app/ }).getByRole("cell"),
  ).toHaveText([">200", ">200", ">200", ">200", ">100", ">100", ">100"]);
  await expect(
    page.getByRole("region", { name: "Keyword rank positions" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy image of the rankings chart" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export CSV of rankings" }),
  ).toBeEnabled();
});

test("the new entrants panel lists apps with their role and a track action", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await expect(
    page.getByRole("heading", { name: "New in your top 10" }),
  ).toBeVisible();

  const competitorRow = page
    .getByRole("listitem")
    .filter({ hasText: "Rival Focus" });
  await expect(competitorRow.getByText("Competitor")).toBeVisible();
  await expect(competitorRow).toContainText("focus timer · #4");

  const unknownRow = page
    .getByRole("listitem")
    .filter({ hasText: "Newcomer Timer" });
  await expect(unknownRow.getByRole("button", { name: "Track" })).toBeVisible();

  await page.getByRole("tab", { name: "14d" }).click();
  await expect(page).toHaveURL(/movers=14/);
});

test("the new entrants panel follows the market select", async ({ page }) => {
  await page.goto("/apps/app-1/rankings?country=us");

  const panel = page
    .locator("[data-slot='card']")
    .filter({ has: page.getByRole("heading", { name: "New in your top 10" }) });
  await expect(panel.getByText("United States · last 7 days")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Rival Focus" }),
  ).toBeVisible();

  await chooseMarket(page, "United Kingdom 0");
  await expect(page).toHaveURL(/country=gb/);
  await expect(panel.getByText("United Kingdom · last 7 days")).toBeVisible();
  await expect(
    page.getByText(
      "Nobody broke into the top 10 for your tracked keywords in United Kingdom",
    ),
  ).toBeVisible();

  await panel.getByRole("button", { name: "Look back 30 days" }).click();
  await expect(page).toHaveURL(/movers=30/);
  await expect(
    panel.getByRole("button", { name: "Look back 30 days" }),
  ).toHaveCount(0);

  await chooseMarket(page, "All markets 5");
  await expect(page).not.toHaveURL(/country=/);
  await expect(panel.getByText("All markets · last 30 days")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Rival Focus" }),
  ).toBeVisible();
});

test("an entrant that is the tracked app reads You and offers no track", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: RANKINGS_EDGE_COOKIE,
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/rankings");

  const own = page
    .getByRole("listitem")
    .filter({ hasText: "focus timer · #3" });
  await expect(own.getByText("You", { exact: true })).toBeVisible();
  await expect(own.getByRole("button", { name: "Track" })).toHaveCount(0);
  await expect(
    page.getByText("2 apps entered your top 10 in the last 7 days."),
  ).toBeVisible();

  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: RTL_ENTRANT_KEYWORD })
      .getByRole("button", { name: "Track" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Chart marks" })).toContainText(
    "Annotation",
  );
});

test("metadata change markers sit under the plot area", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  const markers = chart.locator(".metadata-change-marker");
  await expect(markers).toHaveCount(3);

  const tops = await markers.evaluateAll((nodes) =>
    nodes.map((node) => {
      const surface = node.closest("svg")?.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      if (!surface || surface.height === 0) return 0;
      return (box.top - surface.top) / surface.height;
    }),
  );
  for (const top of tops) {
    expect(top).toBeGreaterThan(0.7);
  }
});

test("the ranking tooltip shows each captured-depth marker", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  await hoverForTooltip(page, chart, page.getByText(">100").first());

  const box = await chart.boundingBox();
  if (!box) throw new Error("Ranking chart is not visible");
  await hoverForTooltip(page, chart, page.getByText(">200").first(), {
    x: box.width * 0.85,
    y: box.height / 2,
  });
});

test("the ranking chart takes keyboard focus and announces positions", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  const plot = chart.getByRole("application");

  await plot.focus();
  await expect(plot).toBeFocused();

  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("focus timer");

  const before = await tooltip.innerText();
  await plot.press("ArrowRight");

  await expect.poll(async () => await tooltip.innerText()).not.toBe(before);
  await expect(tooltip).toContainText("focus timer");
});

async function tooltipOn(page: Page, day: string) {
  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  const plot = chart.getByRole("application");
  const tooltip = chart.getByRole("tooltip");
  await plot.focus();
  await expect(tooltip).toBeVisible();
  const title = formatDayMonth(day);
  for (
    let step = 0;
    step < 10 && !(await tooltip.innerText()).includes(title);
    step += 1
  ) {
    await plot.press("ArrowRight");
  }
  await expect(tooltip).toContainText(title);
  return tooltip;
}

test("a day where every check failed still opens the tooltip", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const tooltip = await tooltipOn(page, utcDaysAgo(5));
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText("Not checked")).toHaveCount(5);
});

test("a keyword whose checks stopped reads not checked on the later days", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const tooltip = await tooltipOn(page, utcDaysAgo(0));
  await expect(tooltip).toContainText("study timer");
  await expect(tooltip.getByText("Not checked")).toHaveCount(1);
});

test("ranking exports preserve historical captured-depth markers", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV of rankings" }).click();
  const download = await downloadPromise;
  const path = await download.path();

  expect(path).not.toBeNull();
  if (path === null) throw new Error("Ranking export did not produce a file");
  const csv = readFileSync(path, "utf8");
  expect(csv).toContain(">100");
  expect(csv).toContain(">200");
});

async function bandLabelBoxes(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg text")]
      .filter((node) => /^Top \d+$/.test(node.textContent?.trim() ?? ""))
      .map((node) => {
        const box = node.getBoundingClientRect();
        return {
          label: node.textContent?.trim() ?? "",
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
        };
      }),
  );
}

for (const width of [320, 375, 768, 1440] as const) {
  test(`the rank band labels do not overlap at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-1/rankings");
    await expect(
      page.getByRole("region", { name: "Keyword rank positions" }),
    ).toBeVisible();
    await expect(page.getByText(/^Top 10$/).first()).toBeVisible();

    const boxes = await bandLabelBoxes(page);

    for (const [index, box] of boxes.entries()) {
      const next = boxes[index + 1];
      if (next === undefined) continue;
      expect(next.top, `${box.label} and ${next.label}`).toBeGreaterThanOrEqual(
        box.bottom,
      );
    }
  });
}

test("every rank band is named at the default chart size", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/apps/app-1/rankings");
  await expect(
    page.getByRole("region", { name: "Keyword rank positions" }),
  ).toBeVisible();
  await expect(page.getByText(/^Top 25$/).first()).toBeVisible();

  expect((await bandLabelBoxes(page)).map((box) => box.label)).toEqual([
    "Top 3",
    "Top 10",
    "Top 25",
  ]);
});

for (const width of [320, 1440] as const) {
  test(`the rank axis reads 1, 10, 25, 50, 100 and 200 from the top at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-1/rankings");
    const chart = page.getByRole("region", { name: "Keyword rank positions" });
    await expect(chart.getByText(/^Top 10$/).first()).toBeVisible();

    const ticks = await chart
      .locator(".recharts-yAxis-tick-labels text")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const box = node.getBoundingClientRect();
            return {
              text: node.textContent?.trim() ?? "",
              top: box.top,
              bottom: box.bottom,
            };
          })
          .sort((a, b) => a.top - b.top),
      );

    expect(ticks.map((tick) => tick.text)).toEqual([
      "1",
      "10",
      "25",
      "50",
      "100",
      "200",
    ]);
    for (const [index, tick] of ticks.entries()) {
      const next = ticks[index + 1];
      if (next !== undefined) {
        expect(next.top).toBeGreaterThanOrEqual(tick.bottom);
      }
    }
  });
}
