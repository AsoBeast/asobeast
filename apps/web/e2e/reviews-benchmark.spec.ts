import type { Page } from "@playwright/test";
import {
  APP_BENCHMARK_CROWDED_ID,
  APP_BENCHMARK_ID,
  APP_BENCHMARK_PLAY_ID,
  APP_BENCHMARK_THIN_ID,
  APP_BENCHMARK_TWO_ID,
  BENCHMARK_FIRST_FOUR_MEDIAN,
  BENCHMARK_ID_PREFIX,
  BENCHMARK_MEANS,
  PLAY_BENCHMARK_MEDIAN,
} from "./fixtures.mts";
import { RIVALS_FAILING_COOKIE } from "./reviews-fixtures.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const RIVAL_HISTORY = new RegExp(
  `/apps/(${BENCHMARK_ID_PREFIX}[^/]+)/ratings-history`,
);

const rivalReads = (page: Page): string[] => {
  const reads: string[] = [];
  page.on("request", (request) => {
    const id = RIVAL_HISTORY.exec(new URL(request.url()).pathname)?.[1];
    if (id) reads.push(id);
  });
  return reads;
};

const reviewsOf = (id: string) => `/apps/${id}/reviews`;

const benchmarkSentence = (page: Page) =>
  page.locator("p", {
    hasText: "Your tracked competitors' new ratings average",
  });

const ownSentence = (page: Page) =>
  page.locator("p", { hasText: "over 30 days, above your overall" });

const medianFigure = (median: number) =>
  new RegExp(
    `Competitors' median new ratings average ${median.toFixed(1)}, \\w+`,
  );

test("compares new ratings with the median of tracked competitors", async ({
  page,
}) => {
  await page.goto(reviewsOf(APP_BENCHMARK_ID));
  const sentence = benchmarkSentence(page);

  await expect(sentence).toContainText(
    "over 30 days (median of 3), below yours",
  );
  await expect(
    sentence.locator("[data-grade]", {
      hasText: medianFigure(BENCHMARK_FIRST_FOUR_MEDIAN),
    }),
  ).toBeVisible();
  await expect(
    sentence.getByRole("button", { name: "About the competitor benchmark" }),
  ).toBeVisible();
  await expect(ownSentence(page)).toBeVisible();
});

test("says so when fewer than three competitors have enough new ratings", async ({
  page,
}) => {
  await page.goto(reviewsOf(APP_BENCHMARK_THIN_ID));

  await expect(
    page.getByText(
      "Fewer than three of your tracked competitors have enough new ratings to compare.",
    ),
  ).toBeVisible();
  await expect(benchmarkSentence(page)).toHaveCount(0);
});

test("asks for no competitor history with fewer than three competitors", async ({
  page,
}) => {
  const reads = rivalReads(page);
  await page.goto(reviewsOf(APP_BENCHMARK_TWO_ID));

  await expect(ownSentence(page)).toBeVisible();
  expect(reads).toEqual([]);
  await expect(page.getByText("tracked competitors")).toHaveCount(0);
});

test("reads at most ten competitors", async ({ page }) => {
  const reads = rivalReads(page);
  const firstTen = BENCHMARK_MEANS.slice(0, 10);
  const figures = firstTen.filter((mean) => mean !== null).length;
  await page.goto(reviewsOf(APP_BENCHMARK_CROWDED_ID));

  await expect(benchmarkSentence(page)).toContainText(`(median of ${figures})`);
  expect(new Set(reads)).toEqual(
    new Set(firstTen.map((_, index) => `${BENCHMARK_ID_PREFIX}${index + 1}`)),
  );
  expect(reads).toHaveLength(10);
  expect(reads).not.toContain(`${BENCHMARK_ID_PREFIX}11`);
});

test("offers a retry when the competitor reads fail and recovers", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [RIVALS_FAILING_COOKIE]: "1" });
  await page.goto(reviewsOf(APP_BENCHMARK_ID));

  await expect(
    page.getByText("Competitor ratings could not load."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(ownSentence(page)).toBeVisible();

  await context.clearCookies({ name: RIVALS_FAILING_COOKIE });
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toHaveCount(1);
  await retry.focus();
  await page.keyboard.press("Enter");

  await expect(benchmarkSentence(page)).toBeVisible();
});

test("keeps its height while the competitor reads settle", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(RIVAL_HISTORY, async (route) => {
    await held;
    await route.continue();
  });
  const rivalRequested = page.waitForRequest(RIVAL_HISTORY);
  await page.goto(reviewsOf(APP_BENCHMARK_ID));
  await rivalRequested;
  const card = page
    .locator("[data-slot=card]")
    .filter({
      has: page.getByRole("region", { name: "Average rating over time" }),
    })
    .first();
  await expect(ownSentence(page)).toBeVisible();
  const before = (await card.boundingBox())?.height;

  release();
  await expect(benchmarkSentence(page)).toBeVisible();

  expect((await card.boundingBox())?.height).toBe(before);
});

test("compares google play new ratings with competitors", async ({ page }) => {
  await page.goto(reviewsOf(APP_BENCHMARK_PLAY_ID));

  await expect(
    benchmarkSentence(page).locator("[data-grade]", {
      hasText: medianFigure(PLAY_BENCHMARK_MEDIAN),
    }),
  ).toBeVisible();
  await expect(benchmarkSentence(page)).toContainText("(median of 3)");
});

test("keeps focus on the help when the benchmark gains a third figure", async ({
  page,
}) => {
  let upgraded = false;
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.clock.install();
  await page.route(RIVAL_HISTORY, async (route) => {
    if (!upgraded) return route.continue();
    await held;
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(
      `/apps/${BENCHMARK_ID_PREFIX}4/`,
      `/apps/${BENCHMARK_ID_PREFIX}3/`,
    );
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  });
  await page.goto(reviewsOf(APP_BENCHMARK_THIN_ID));
  const tooFew = page.getByText(
    "Fewer than three of your tracked competitors have enough new ratings to compare.",
  );
  await expect(tooFew).toBeVisible();
  const ranges = page.getByRole("tablist", { name: "Date range" });

  await page.clock.fastForward(31_000);
  await ranges.getByRole("tab", { name: "90d" }).click();
  await expect(page.getByText(/over 90 days/).first()).toBeVisible();
  upgraded = true;
  await ranges.getByRole("tab", { name: "30d" }).click();
  await expect(tooFew).toBeVisible();
  const help = page.getByRole("button", {
    name: "About the competitor benchmark",
  });
  await help.focus();
  release();

  await expect(benchmarkSentence(page)).toContainText("(median of 3)");
  await expect(help).toBeFocused();
});

test("draws the benchmark from the competitor list the page already read", async ({
  page,
}) => {
  const listReads: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname ===
      `/api/backend/apps/${APP_BENCHMARK_ID}/competitors`
    ) {
      listReads.push(request.url());
    }
  });
  await page.goto(reviewsOf(APP_BENCHMARK_ID));

  await expect(benchmarkSentence(page)).toContainText("(median of 3)");
  expect(listReads).toEqual([]);
});
