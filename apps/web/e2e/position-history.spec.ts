import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { RankingPoint } from "@asobeast/shared";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import {
  PL_HISTORY_COOKIE,
  RANKINGS_FAIL_COOKIE,
  utcDaysAgo,
} from "./fixtures.mts";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";
import { formatDayMonth } from "../src/lib/format";

const PAGE = "/apps/app-1/keywords";

const RANKINGS = /\/api\/backend\/apps\/app-1\/rankings\?/;

const day = (daysAgo: number) => formatDayMonth(utcDaysAgo(daysAgo));

const trigger = (page: Page, keyword: string) =>
  page.getByRole("button", {
    name: new RegExp(`^Position history: ${keyword}`),
  });

const dialog = (page: Page, keyword: string) =>
  page.getByRole("dialog", { name: `Position history ${keyword}` });

const chart = (page: Page, keyword: string) =>
  dialog(page, keyword).getByRole("region", {
    name: `Position history of ${keyword}`,
  });

async function openHistory(page: Page, keyword: string) {
  await (await hydrated(trigger(page, keyword))).click();
  await expect(dialog(page, keyword)).toBeVisible();
  return dialog(page, keyword);
}

async function answerRankings(page: Page, points: RankingPoint[]) {
  await page.route(RANKINGS, (route) =>
    route.fulfill({
      json: {
        series: [
          {
            keywordId: "kw-1",
            text: "focus timer",
            store: "APP_STORE",
            country: "us",
            points,
          },
        ],
      },
    }),
  );
}

test("E-PH-01 the popover shows the position, the facts, the chart and the home listing changes", async ({
  page,
}) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");

  await expect(popover).toContainText("App Store · United States");
  await expect(popover).toContainText(/Position 3, \w+/);
  await expect(popover.getByRole("definition")).toHaveText([
    "#3",
    "At its best",
    "Top 3 for 1 day",
  ]);
  await expect(popover.getByRole("tab", { name: "30d" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(chart(page, "focus timer")).toBeVisible();
  await expect(popover).toContainText(
    `Listing changes: ${day(3)} Screenshots · ${day(2)} Screenshot captions · ${day(1)} Title, Description`,
  );
  await expect(popover).not.toContainText("Price");
});

async function tooltipOn(page: Page, keyword: string, daysAgo: number) {
  const plot = chart(page, keyword).getByRole("application");
  const tooltip = chart(page, keyword).getByRole("tooltip");
  await plot.focus();
  await expect(tooltip).toBeVisible();
  for (
    let step = 0;
    step < 10 && !(await tooltip.innerText()).includes(day(daysAgo));
    step += 1
  ) {
    await plot.press("ArrowRight");
  }
  await expect(tooltip).toContainText(day(daysAgo));
  return tooltip;
}

test("E-PH-15 the tooltip reads the position, the movement and the listing change of a day", async ({
  page,
}) => {
  await page.goto(PAGE);
  await openHistory(page, "focus timer");

  const tooltip = await tooltipOn(page, "focus timer", 1);
  await expect(tooltip).toContainText(/Position\s*5/);
  await expect(tooltip).toContainText(`No change since ${day(2)}`);
  await expect(tooltip).toContainText("Title, Description changed");
});

test("E-PH-16 the newest point is ringed and the best position is drawn only when the keyword ranked", async ({
  page,
}) => {
  await page.goto(PAGE);
  await openHistory(page, "focus timer");
  await expect(chart(page, "focus timer")).toContainText("Best 3");
  await expect(
    chart(page, "focus timer").locator(".recharts-reference-dot"),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  await openHistory(page, "productivity app");
  await expect(chart(page, "productivity app")).toBeVisible();
  await expect(chart(page, "productivity app")).not.toContainText("Best");
  await expect(
    chart(page, "productivity app").locator(".recharts-reference-dot"),
  ).toHaveCount(0);
});

test("E-PH-02 Enter and Space open it and Escape returns focus", async ({
  page,
}) => {
  await page.goto(PAGE);
  const button = await hydrated(trigger(page, "focus timer"));

  for (const key of ["Enter", "Space"]) {
    await button.focus();
    await page.keyboard.press(key);
    await expect(dialog(page, "focus timer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page, "focus timer")).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test("E-PH-03 nothing is requested until a popover opens", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (RANKINGS.test(request.url())) requested.push(request.url());
  });
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
  expect(requested).toEqual([]);

  await openHistory(page, "focus timer");
  await expect(chart(page, "focus timer")).toBeVisible();

  expect(requested).toHaveLength(1);
  expect(requested[0]).toContain("keywordIds=kw-1");
});

test("E-PH-04 a range switch keeps the previous chart until the next lands", async ({
  page,
}) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");
  await expect(chart(page, "focus timer")).toBeVisible();

  const held = await holdRequest(page, RANKINGS, "GET");
  const request = page.waitForRequest(RANKINGS);
  await popover.getByRole("tab", { name: "7d" }).click();

  expect(new URL((await request).url()).searchParams.get("from")).toBe(
    utcDaysAgo(7),
  );
  await expect(chart(page, "focus timer")).toHaveAttribute("aria-busy", "true");
  held.release();
  await expect(chart(page, "focus timer")).not.toHaveAttribute("aria-busy");
});

test("E-PH-05 Open in Rankings carries the keyword and the range", async ({
  page,
}) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");
  await popover.getByRole("tab", { name: "90d" }).click();
  await popover.getByRole("link", { name: "Open in Rankings" }).click();

  await expect(page).toHaveURL(
    /\/apps\/app-1\/rankings\?keywords=kw-1&range=90d$/,
  );
  await expect(
    page.getByRole("button", { name: /^Remove focus timer/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "90d" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("E-PH-06 a failed read stays inside the popover and retries", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [RANKINGS_FAIL_COOKIE]: "1" });
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");

  await expect(popover.getByRole("alert")).toHaveText(
    "Could not load the position history.",
    { timeout: 15_000 },
  );
  await expect(
    page.getByRole("cell", { name: "pomodoro", exact: true }),
  ).toBeVisible();

  await context.clearCookies({ name: RANKINGS_FAIL_COOKIE });
  await popover.getByRole("button", { name: "Retry" }).click();
  await expect(chart(page, "focus timer")).toBeVisible();
});

test("E-PH-07 an empty range offers the widest one", async ({ page }) => {
  await answerRankings(page, []);
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");

  await expect(popover).toContainText("No checks in the last 30 days");
  await popover.getByRole("button", { name: "Show 90 days" }).click();

  await expect(popover.getByRole("tab", { name: "90d" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(popover).toContainText("No checks in the last 90 days");
  await expect(
    popover.getByRole("button", { name: "Show 90 days" }),
  ).toHaveCount(0);
});

test("E-PH-08 fewer than four checks say when the line appears", async ({
  page,
}) => {
  await answerRankings(page, [
    { date: utcDaysAgo(2), position: 5, depth: 200 },
    { date: utcDaysAgo(1), position: 4, depth: 200 },
  ]);
  await page.goto(PAGE);
  const popover = await openHistory(page, "focus timer");

  await expect(chart(page, "focus timer")).toBeVisible();
  await expect(popover).toContainText(
    "2 checks so far, the line appears after 4",
  );
});

test("E-PH-09 a keyword never found says so", async ({ page }) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "productivity app");

  await expect(popover).toContainText("Not in the top 200 in this range");
});

test("E-PH-10 a paused keyword names its last check", async ({ page }) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "time blocking");

  await expect(popover).toContainText(`Paused, last checked ${day(10)}`);
});

test("E-PH-11 a market keyword marks only its own market's listing changes", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [PL_HISTORY_COOKIE]: "1" });
  await page.goto(`${PAGE}?country=pl`);
  const popover = await openHistory(page, "minutnik skupienia");

  await expect(popover).toContainText("App Store · Poland");
  await expect(popover).toContainText(
    `Listing changes: ${day(3)} Screenshot images · ${day(2)} Title · ${day(1)} Title`,
  );
  await expect(popover).not.toContainText("Description");
  await expect(popover).not.toContainText("Screenshot captions");
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
]) {
  test(`E-PH-12 the popover stays inside a ${viewport.width} by ${viewport.height} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(PAGE);
    const popover = await openHistory(page, "focus timer");
    await expect(chart(page, "focus timer")).toBeVisible();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

for (const theme of THEMES) {
  test(`E-PH-13 the open popover has no accessibility violation in the ${theme} theme`, async ({
    page,
  }) => {
    expect(await contrastViolations(page, theme, PAGE)).toEqual([]);
    await openHistory(page, "focus timer");
    await expect(chart(page, "focus timer")).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
  });
}

test("E-PH-14 a stale keyword opens with the day of its last check", async ({
  page,
}) => {
  await page.goto(PAGE);
  const popover = await openHistory(page, "study timer");

  await expect(popover).toContainText("the checks since then did not finish");
  await expect(popover.getByLabel(/since yesterday/)).toHaveCount(0);
});
