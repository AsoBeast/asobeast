import type { Page, Request } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_GP_DETAIL } from "./fixtures.mts";
import {
  DISCOVERY_NONE_COOKIE,
  DISCOVERY_PAGED_APP,
  DISCOVERY_PENDING_COOKIE,
} from "./keyword-discoveries.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const KEYWORDS = "/apps/app-1/keywords";
const DISCOVERED = `${KEYWORDS}?tab=discovered`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  for (const id of ["app-1", APP_GP_DETAIL.id, DISCOVERY_PAGED_APP]) {
    await request.post(`${MOCK_API_URL}/__reset/keyword-discoveries/${id}`, {
      failOnStatusCode: true,
    });
  }
});

const cookie = (name: string) => ({
  name,
  value: "1",
  domain: "localhost",
  path: "/",
});

const lists = (page: Page) =>
  page.getByRole("tablist", { name: "Keyword lists" });

const states = (page: Page) =>
  page.getByRole("tablist", { name: "Discovered keyword states" });

const table = (page: Page) =>
  page.getByRole("table", { name: /Keyword discoveries/ });

const keywordsIn = (page: Page) => table(page).getByRole("rowheader");

const rowOf = (page: Page, keyword: string) =>
  table(page)
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: new RegExp(`^${keyword}`) }),
    });

const discoveryReads = (page: Page): Request[] => {
  const reads: Request[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      /\/apps\/app-1\/keyword-discoveries(\?|$)/.test(request.url())
    ) {
      reads.push(request);
    }
  });
  return reads;
};

test("the keyword lists switch between tracked and discovered through the url", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  const tracked = lists(page).getByRole("tab", { name: "Tracked 5" });
  const discovered = lists(page).getByRole("tab", { name: /^Discovered 9/ });
  await expect(tracked).toHaveAttribute("aria-selected", "true");
  await expect(discovered).toHaveAttribute(
    "aria-label",
    "Discovered 9, new discoveries to review",
  );
  await expect(
    page.getByRole("heading", { name: "Tracked keywords" }),
  ).toBeVisible();

  await discovered.click();

  await expect(page).toHaveURL(/[?&]tab=discovered/);
  await expect(discovered).toHaveAttribute("aria-selected", "true");
  await expect(discovered).not.toHaveAttribute("aria-label");
  await expect(
    page.getByRole("heading", { name: "Discovered keywords" }),
  ).toBeVisible();
  await expect(table(page)).toBeVisible();

  await tracked.click();

  await expect(page).not.toHaveURL(/tab=/);
  await expect(
    page.getByRole("heading", { name: "Tracked keywords" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /Tracked keywords/ }),
  ).toBeVisible();
});

test("a deep link opens one state of the discovered list", async ({ page }) => {
  await page.goto(`${DISCOVERED}&state=ranked`);

  await expect(
    states(page).getByRole("tab", { name: "Ranked 3" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(keywordsIn(page)).toHaveText([
    /^focus timer app/,
    /^pomodoro clock/,
    /^deep work/,
  ]);
});

test("the state tabs filter the one list in the browser", async ({ page }) => {
  const reads = discoveryReads(page);
  await page.goto(DISCOVERED);
  await expect(keywordsIn(page)).toHaveCount(9);
  const before = reads.length;

  await states(page).getByRole("tab", { name: "Opportunities 1" }).click();

  await expect(page).toHaveURL(/state=opportunity/);
  await expect(keywordsIn(page)).toHaveText([/^study planner/]);

  await states(page).getByRole("tab", { name: "All 9" }).click();

  await expect(page).not.toHaveURL(/state=/);
  await expect(keywordsIn(page)).toHaveCount(9);
  expect(reads.length).toBe(before);
});

test("each row names its source, rank and scores", async ({ page }) => {
  await page.goto(DISCOVERED);

  const headers = table(page).getByRole("columnheader");
  await expect(headers).toContainText([
    "Keyword",
    "Source",
    "Rank",
    "Popularity",
    "Difficulty",
    "Relevance",
    "Opportunity",
  ]);
  await expect(rowOf(page, "focus timer app")).toContainText("Your title");
  await expect(rowOf(page, "deep work")).toContainText("Competitors");
  await expect(rowOf(page, "study planner")).toContainText("Reviews");
  await expect(rowOf(page, "time blocker")).toContainText("Apple popularity");
  await expect(rowOf(page, "productivity tracker")).toContainText(
    "Your other apps",
  );
  await expect(rowOf(page, "concentration")).toContainText("Your description");

  await expect(rowOf(page, "focus timer app")).toContainText("Rank 3");
  await expect(rowOf(page, "deep work")).toContainText("Rank 120");
  await expect(rowOf(page, "study planner")).toContainText(
    "Not found in the top 200",
  );
  await expect(rowOf(page, "concentration")).toContainText(
    "Not found in the top 50",
  );
  await expect(rowOf(page, "work sprint")).toContainText("Not checked yet");
  await expect(table(page)).not.toContainText("Rank 0");

  await expect(rowOf(page, "study planner")).toContainText(
    "Opportunity 41, fair",
  );
  await expect(rowOf(page, "time blocker")).toContainText("Popularity 70");
  await expect(rowOf(page, "time blocker")).toContainText(
    "No difficulty score",
  );
  await expect(
    rowOf(page, "focus timer app").getByText("Recommended"),
  ).toBeVisible();
});

test("the market pills scope the list and its counts", async ({ page }) => {
  await page.goto(DISCOVERED);

  await page
    .getByRole("group", { name: "Keyword markets" })
    .getByRole("button", { name: /^PL/ })
    .click();

  await expect(page).toHaveURL(/country=pl/);
  await expect(page).toHaveURL(/tab=discovered/);
  await expect(keywordsIn(page)).toHaveText([
    /^minutnik skupienia/,
    /^timer do nauki/,
  ]);
  await expect(
    states(page).getByRole("tab", { name: "Ranked 1" }),
  ).toBeVisible();
  await expect(
    lists(page).getByRole("tab", { name: /^Discovered 2/ }),
  ).toBeVisible();
});

test("a google play app names its short description", async ({ page }) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/keywords?tab=discovered`);

  await expect(rowOf(page, "daily focus")).toContainText(
    "Your short description",
  );
  await expect(table(page)).not.toContainText("Apple popularity");
});

test("a long list pages fifty rows at a time and marks the best fifty", async ({
  page,
}) => {
  await page.goto(`/apps/${DISCOVERY_PAGED_APP}/keywords?tab=discovered`);

  await expect(keywordsIn(page)).toHaveCount(50);
  await expect(page.getByText("Showing 50 of 120")).toBeVisible();

  await page.getByRole("button", { name: "Show 50 more" }).click();

  await expect(keywordsIn(page)).toHaveCount(100);
  await expect(
    rowOf(page, "discovered phrase 050").getByText("Recommended"),
  ).toBeVisible();
  await expect(
    rowOf(page, "discovered phrase 051").getByText("Recommended"),
  ).toHaveCount(0);
});

test("the footer says when the list was checked and what the week holds", async ({
  page,
}) => {
  await page.goto(DISCOVERED);

  await expect(
    page.getByText(
      /^Checked 3 days ago\. 40 checks a week, 12 used; the next run is on Monday\.$/,
    ),
  ).toBeVisible();
});

test("a list that never ran says when discovery runs", async ({
  page,
  context,
}) => {
  await context.addCookies([cookie(DISCOVERY_NONE_COOKIE)]);
  await page.goto(DISCOVERED);

  await expect(page.getByText("No discoveries yet")).toBeVisible();
  await expect(
    page.getByText(
      /^Not checked yet\. 40 checks a week; the next run is on Monday\.$/,
    ),
  ).toBeVisible();
  await expect(table(page)).toHaveCount(0);
});

test("an empty state names its reason and offers every row", async ({
  page,
}) => {
  await page.goto(`${DISCOVERED}&country=gb&state=ranked`);

  await expect(page.getByText("Nothing ranked yet")).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();

  await expect(page).not.toHaveURL(/state=/);
  await expect(page.getByText("Nothing to review")).toBeVisible();
});

test("pending checks poll until they land", async ({ page, context }) => {
  await context.addCookies([cookie(DISCOVERY_PENDING_COOKIE)]);
  await page.clock.install();
  const reads = discoveryReads(page);
  await page.goto(DISCOVERED);
  await expect(page.getByText("3 checks pending")).toBeVisible();

  await page.clock.runFor(16_000);

  await expect(page.getByText("3 checks pending")).toBeHidden();
  const settled = reads.length;
  await page.clock.runFor(60_000);
  expect(reads.length).toBe(settled);
});

test("the discovered list fits a narrow screen", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(DISCOVERED);
    await expect(table(page)).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("region", { name: "Keyword discoveries" }),
    ).toBeVisible();
  }
});
