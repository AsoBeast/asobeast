import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { formatDayMonth } from "../src/lib/format";
import {
  FAIL_ANALYSIS_COOKIE,
  GAP_STATE_COOKIE,
  utcDaysAgo,
} from "./fixtures.mts";
import { MOCK_API_URL } from "./localizations.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/competitors";

const section = (page: Page) =>
  page.getByRole("region", { name: "Where competitors beat you" });

const gapTable = (page: Page) =>
  section(page).getByRole("table", { name: /^Keyword/ });

const tab = (page: Page, name: string) =>
  section(page).getByRole("tab", { name, exact: true });

const keywordTexts = (page: Page) =>
  gapTable(page).locator("[data-breakdown-keyword]").allTextContents();

const rowOf = (page: Page, keyword: string): Locator =>
  gapTable(page)
    .getByRole("row")
    .filter({
      has: page.getByRole("button", { name: `${keyword}, why apps rank` }),
    });

async function open(page: Page, path = PAGE): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(
    section(page).getByRole("tablist", { name: "Gap lists" }),
  ).toBeVisible();
}

async function withState(context: BrowserContext, state: string) {
  await seedCookies(context, { [GAP_STATE_COOKIE]: state });
}

test("lists the gap analysis between the tracked competitors and discovery", async ({
  page,
}) => {
  await open(page);

  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  const gaps = headings.indexOf("Where competitors beat you");
  expect(gaps).toBeGreaterThan(
    headings.indexOf("Track the apps you rank against"),
  );
  expect(gaps).toBeLessThan(headings.indexOf("Apps you don’t track yet"));
});

test("counts every list in its tab and selects the keyword gaps first", async ({
  page,
}) => {
  await open(page);

  for (const name of [
    "Keyword gaps (4)",
    "Winnable now (2)",
    "Threats (2)",
    "You lead (2)",
  ]) {
    await expect(tab(page, name)).toBeVisible();
    await expect(tab(page, name)).not.toHaveAttribute("aria-controls", /.+/);
  }
  await expect(tab(page, "Keyword gaps (4)")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(new URL(page.url()).searchParams.has("gaps")).toBe(false);
  expect(await keywordTexts(page)).toEqual([
    "productivity app",
    "flow state",
    "deep focus",
    "study timer",
  ]);
});

test("keeps the tab in the url across a reload and back", async ({ page }) => {
  await open(page);

  await tab(page, "Winnable now (2)").click();
  await expect(page).toHaveURL(/[?&]gaps=winnable/);
  await expect
    .poll(() => keywordTexts(page))
    .toEqual(["productivity app", "study timer"]);

  await page.reload();
  await expect(tab(page, "Winnable now (2)")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.goBack();
  await expect(tab(page, "Keyword gaps (4)")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("names the columns of each list", async ({ page }) => {
  await open(page);
  const headers = () =>
    gapTable(page).getByRole("columnheader").allTextContents();

  expect(await headers()).toEqual([
    "Keyword",
    "Best competitor",
    "Their position",
    "Your position",
    "Popularity",
    "Difficulty",
    "Opportunity",
  ]);

  await tab(page, "Threats (2)").click();
  await expect.poll(headers).toContain("Why");

  await tab(page, "You lead (2)").click();
  await expect.poll(headers).toContain("Margin");
  expect(await headers()).not.toContain("Why");
});

test("reads an app that does not rank and a stale check", async ({ page }) => {
  await open(page);

  await expect(rowOf(page, "productivity app")).toContainText("Not ranking");
  await expect(
    rowOf(page, "flow state").getByRole("img", {
      name: `last checked ${formatDayMonth(utcDaysAgo(5))}`,
    }),
  ).toBeVisible();
  await expect(
    rowOf(page, "deep focus").getByRole("img", { name: /last checked/ }),
  ).toHaveCount(0);
});

test("says why a keyword is threatened and how far you lead", async ({
  page,
}) => {
  await open(page, `${PAGE}?gaps=threats`);

  const rows = gapTable(page).getByRole("row");
  await expect(rows.filter({ hasText: "United States" })).toContainText(
    `Overtook you on ${formatDayMonth(utcDaysAgo(3))}`,
  );
  await expect(rows.filter({ hasText: "Germany" })).toContainText(
    "Closing in, rose 2",
  );

  await tab(page, "You lead (2)").click();
  await expect(rowOf(page, "focus timer")).toContainText("6 ahead");
  await expect(rowOf(page, "time blocking")).toContainText(
    "No competitor ranks",
  );
  await expect(rowOf(page, "focus timer")).toContainText("Rival Focus");
});

test("filters the lists by market", async ({ page }) => {
  await open(page);

  await section(page)
    .getByRole("combobox", { name: "Filter by gap market" })
    .click();
  const options = await page.getByRole("option").allTextContents();
  expect(options).toEqual([
    "All markets",
    "United States",
    "Germany",
    "Poland",
  ]);

  await page.getByRole("option", { name: "Germany" }).click();
  await expect(page).toHaveURL(/[?&]gapCountry=de/);
  for (const name of [
    "Keyword gaps (0)",
    "Winnable now (0)",
    "Threats (1)",
    "You lead (0)",
  ]) {
    await expect(tab(page, name)).toBeVisible();
  }

  await section(page)
    .getByRole("combobox", { name: "Filter by gap market" })
    .click();
  await page.getByRole("option", { name: "Poland" }).click();
  await expect(section(page)).toContainText(
    "Your competitors have not been checked in Poland yet.",
  );
});

test("searches and sorts with keys of its own", async ({ page }) => {
  await open(page);

  await section(page)
    .getByRole("textbox", { name: "Search gap keywords" })
    .fill("focus");
  await expect(page).toHaveURL(/[?&]gapQ=focus/);
  await expect.poll(() => keywordTexts(page)).toEqual(["deep focus"]);

  await gapTable(page)
    .getByRole("button", { name: /^Popularity/ })
    .click();
  await expect(page).toHaveURL(/[?&]gapSort=popularity/);
  const url = new URL(page.url());
  expect(url.searchParams.has("q")).toBe(false);
  expect(url.searchParams.has("sort")).toBe(false);
  await expect(
    gapTable(page).getByRole("columnheader", { name: /^Popularity/ }),
  ).toHaveAttribute("aria-sort", /ascending|descending/);
});

for (const [state, text] of [
  ["no-competitors", "Add a competitor to see gaps"],
  ["all-delisted", "Every competitor you track is delisted"],
  ["nothing-to-win", "No keyword gaps right now."],
] as const) {
  test(`explains an empty analysis when ${state}`, async ({
    page,
    context,
  }) => {
    await withState(context, state);
    await open(page);

    await expect(section(page)).toContainText(text);
    await expect(gapTable(page)).toHaveCount(0);
    await expect(tab(page, "Keyword gaps (0)")).toBeVisible();
  });
}

test("links an app without competitors to the add form", async ({
  page,
  context,
}) => {
  await withState(context, "no-competitors");
  await open(page);

  await expect(
    section(page).getByRole("link", { name: "Add a competitor" }),
  ).toHaveAttribute("href", "#competitor-search");
});

test("keeps the page when the analysis fails and retries it", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await seedCookies(context, { [FAIL_ANALYSIS_COOKIE]: "1" });
  await page.goto(PAGE);

  await expect(section(page)).toContainText(
    "The gap analysis could not be loaded.",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("table", { name: /compared with each tracked competitor/ }),
  ).toBeVisible();

  await context.clearCookies({ name: FAIL_ANALYSIS_COOKIE });
  await section(page).getByRole("button", { name: "Retry" }).click();
  await expect(tab(page, "Keyword gaps (4)")).toBeVisible();
});

test("asks for nothing while the section is collapsed", async ({
  page,
  context,
  request,
}) => {
  const token = randomUUID();
  await seedCookies(context, {
    e2e_request_log: token,
    asobeast_collapsed: encodeURIComponent("competitors.gaps"),
  });
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
  const count = async () =>
    (
      (await (
        await request.get(`${MOCK_API_URL}/__log/analysis-requests/${token}`)
      ).json()) as { count: number }
    ).count;

  expect(await count()).toBe(0);

  await page
    .getByRole("button", { name: "Where competitors beat you", exact: true })
    .click();
  await expect(tab(page, "Keyword gaps (4)")).toBeVisible();
  expect(await count()).toBe(1);
});

test("opens the keyword breakdown from a row", async ({ page }) => {
  await open(page);

  await page
    .getByRole("button", { name: "productivity app, why apps rank" })
    .first()
    .click();
  await expect(page).toHaveURL(/[?&]keyword=kw-4/);
  await expect(
    page.getByRole("dialog", { name: "Why apps rank for this keyword" }),
  ).toBeVisible();
});

for (const [name, subject, prefix, rows] of [
  ["Keyword gaps (4)", "keyword gaps", "keyword-gaps", 4],
  ["Winnable now (2)", "winnable keywords", "winnable-keywords", 2],
  ["Threats (2)", "threats", "keyword-threats", 2],
  ["You lead (2)", "keywords you lead", "keywords-you-lead", 2],
] as const) {
  test(`exports the ${subject} shown`, async ({ page }) => {
    await open(page);
    await tab(page, name).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: `Export CSV of ${subject}`, exact: true })
        .click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^${prefix}-app-1-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
    );
    const lines = readFileSync(await download.path(), "utf8")
      .split("\r\n")
      .filter(Boolean);
    expect(lines).toHaveLength(rows + 1);
  });
}

for (const width of [320, 375]) {
  test(`fits a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  });
}

test("explains the rules behind the lists", async ({ page }) => {
  await open(page);

  await section(page)
    .getByRole("button", { name: "About gap analysis" })
    .click();
  const popover = page.getByRole("dialog", {
    name: "How the gap lists are chosen",
  });
  await expect(popover).toContainText("top 30");
  await expect(popover).toContainText("below 100");
  await expect(popover).toContainText("ranks 11 or lower");
  await expect(popover).toContainText("1 to 3 places");
  await expect(popover).toContainText("last 7 days");
  await expect(
    popover.getByRole("link", { name: "Read how the lists are chosen" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/docs\.asobeast\.com\/guides\/competitors(#gap-analysis)?$/,
  );
});
