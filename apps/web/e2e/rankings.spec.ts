import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";
import { utcDaysAgo } from "./fixtures.mts";
import { formatDayMonth } from "../src/lib/format";

test("rankings page renders the chart and filters series through the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  await expect(chart).toBeVisible();
  await expect(
    chart.getByRole("list", { name: "Charted series" }).getByRole("listitem"),
  ).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
    "study timer (US)",
    "productivity app (US)",
    "time blocking (US)",
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

test("the market pills scope the report to one storefront", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const pills = page.getByRole("group", { name: "Report markets" });
  await expect(pills).toBeVisible();
  await expect(
    pills.getByRole("button", { name: "All markets 5" }),
  ).toHaveAttribute("aria-pressed", "true");

  await pills.getByRole("button", { name: "US 5" }).click();
  await expect(page).toHaveURL(/country=us/);
  await expect(pills.getByRole("button", { name: "US 5" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "5 selected" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Keyword rank positions" })
      .getByRole("list", { name: "Charted series" })
      .getByRole("listitem"),
  ).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
    "study timer (US)",
    "productivity app (US)",
    "time blocking (US)",
  ]);

  await pills.getByRole("button", { name: "PL 0" }).click();
  await expect(page).toHaveURL(/country=pl/);
  await expect(
    page.getByText("No keywords tracked in Poland yet"),
  ).toBeVisible();

  await pills.getByRole("button", { name: "All markets 5" }).click();
  await expect(page).not.toHaveURL(/country=/);
});

test("the serp movers card lists entrants with badges and a track action", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await expect(page.getByText(/New entrants in your keywords/)).toBeVisible();

  const competitorRow = page
    .getByRole("listitem")
    .filter({ hasText: "Rival Focus" });
  await expect(competitorRow.getByText("Competitor")).toBeVisible();
  await expect(competitorRow).toContainText("entered the top 10 for");
  await expect(competitorRow).toContainText("at #4");

  const unknownRow = page
    .getByRole("listitem")
    .filter({ hasText: "Newcomer Timer" });
  await expect(unknownRow.getByRole("button", { name: "Track" })).toBeVisible();

  await page.getByRole("tab", { name: "14d" }).click();
  await expect(page).toHaveURL(/movers=14/);
});

test("the serp movers card follows the market pills", async ({ page }) => {
  await page.goto("/apps/app-1/rankings?country=us");

  await expect(page.getByText("SERP movers (United States)")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Rival Focus" }),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Report markets" })
    .getByRole("button", { name: "GB 0" })
    .click();
  await expect(page).toHaveURL(/country=gb/);
  await expect(page.getByText("SERP movers (United Kingdom)")).toBeVisible();
  await expect(
    page.getByText(
      "Nobody broke into the top 10 for your tracked keywords in United Kingdom",
    ),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Report markets" })
    .getByRole("button", { name: "All markets 5" })
    .click();
  await expect(page).not.toHaveURL(/country=/);
  await expect(page.getByText("SERP movers", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Rival Focus" }),
  ).toBeVisible();
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
