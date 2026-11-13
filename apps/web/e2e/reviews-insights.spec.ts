import { RATINGS_HISTORY_COOKIE } from "./reviews-fixtures.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const REVIEWS = "/apps/app-1/reviews";

test("the page opens with what arrived, what waits and how the rating moved", async ({
  page,
}) => {
  await page.goto(REVIEWS);

  await expect(
    page.getByText("1 new review since yesterday. 3 need a reply. Rating 4."),
  ).toBeVisible();
});

test("an app with nothing stored says so and draws no side panels", async ({
  page,
}) => {
  await page.goto("/apps/app-2/reviews");

  await expect(
    page.getByText(
      "No reviews or ratings are stored yet. They are read on the daily run.",
    ),
  ).toBeVisible();
  await expect(page.getByText("No reviews stored yet")).toBeVisible();
  expect(
    await page.getByRole("heading", { name: "Ratings distribution" }).count(),
  ).toBe(0);
  expect(
    await page.getByRole("heading", { name: "Rating by version" }).count(),
  ).toBe(0);
});

test("the ratings figure switches the chart to new ratings and keeps it on reload", async ({
  page,
}) => {
  await page.goto(REVIEWS);
  const figures = page.getByRole("group", { name: "Ratings figures" });
  const rating = figures.getByRole("button", { name: /^Rating\b(?!s)/ });
  const ratings = figures.getByRole("button", { name: /^Ratings/ });

  await expect(rating).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("region", { name: "Average rating over time" }),
  ).toBeVisible();

  await ratings.click();

  await expect(page).toHaveURL(/ratingsView=volume/);
  await expect(ratings).toHaveAttribute("aria-pressed", "true");
  await expect(ratings).toBeFocused();
  await expect(
    page.getByRole("region", { name: "New ratings between daily reads" }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("region", { name: "New ratings between daily reads" }),
  ).toBeVisible();
});

test("a version row filters the list to that version and clears it again", async ({
  page,
}) => {
  await page.goto(REVIEWS);
  const versions = page.getByRole("region", { name: "Rating by version" });
  const older = versions.getByRole("button", { name: /^v3\.4\.0, 2 reviews/ });

  await expect(
    versions.getByRole("button", {
      name: "v3.4.1, 3 reviews, average rating 4.3, fair",
    }),
  ).toBeVisible();
  await expect(versions.getByText("From all 5 reviews")).toBeVisible();

  await older.click();

  await expect(page).toHaveURL(/version=3\.4\.0/);
  await expect(older).toHaveAttribute("aria-pressed", "true");
  await expect(older).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("combobox", { name: "Filter by version" }),
  ).toHaveText("v3.4.0");

  await older.click();

  await expect(page).not.toHaveURL(/version=/);
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("the version panel says when it reads only the newest reviews", async ({
  page,
}) => {
  await page.goto("/apps/app-long/reviews");

  await expect(
    page
      .getByRole("region", { name: "Rating by version" })
      .getByText("From the 50 newest of 60 reviews"),
  ).toBeVisible();
});

test("the distribution names its total, the day it was read and the low share", async ({
  page,
}) => {
  await page.goto(REVIEWS);
  const distribution = page.getByRole("region", {
    name: "Ratings distribution",
  });

  await expect(distribution.getByText(/^23,720 ratings · read /)).toContainText(
    "3.1% at two stars or less",
  );
  await expect(distribution.getByRole("listitem")).toHaveCount(5);
});

test("a history of two reads shows the latest figure instead of a chart", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [RATINGS_HISTORY_COOKIE]: "short" });
  await page.goto(REVIEWS);

  await expect(page.getByText("Latest average rating")).toBeVisible();
  await expect(
    page.getByText("A trend line needs a few more daily snapshots."),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Ratings figures" })
    .getByRole("button", { name: /^Ratings/ })
    .click();

  await expect(page.getByText("Ratings so far")).toBeVisible();
});

test("a falling rating reads down in the sentence and on the figure", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [RATINGS_HISTORY_COOKIE]: "drop" });
  await page.goto(REVIEWS);

  await expect(
    page.getByText(/Rating 4\.2, down 0\.35 over 7 days\./),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Ratings figures" })
      .getByRole("button", { name: /^Rating\b(?!s)/ }),
  ).toContainText("-0.35");
});

test("a single read of the ratings shows the count instead of an empty chart", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [RATINGS_HISTORY_COOKIE]: "single" });
  await page.goto(`${REVIEWS}?ratingsView=volume`);

  await expect(page.getByText("Ratings so far")).toBeVisible();
  expect(await page.getByText("No ratings history yet").count()).toBe(0);
});

test("the reply status switch moves by arrow keys and filters on Enter only", async ({
  page,
}) => {
  await page.goto(REVIEWS);
  const tabs = page.getByRole("tablist", { name: "Reply status" });

  await tabs.getByRole("tab", { name: /All/ }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(tabs.getByRole("tab", { name: /Needs reply/ })).toBeFocused();
  expect(page.url()).not.toContain("replyState");

  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/replyState=needs_reply/);
  await expect(page).toHaveURL(/sort=lowest/);
  await expect(tabs.getByRole("tab", { name: /Needs reply/ })).toBeFocused();
});

test("the panels read in the order they stack on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(REVIEWS);

  const tops = await Promise.all(
    [
      page.getByRole("group", { name: "Ratings figures" }),
      page.getByRole("tablist", { name: "Reply status" }),
      page.getByRole("region", { name: "Ratings distribution" }),
      page.getByRole("region", { name: "Rating by version" }),
      page.getByRole("region", { name: "What people mention" }),
    ].map(async (panel) => (await panel.boundingBox())!.y),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

test("a play app with five reply states fits a 320px phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/apps/app-gp/reviews");
  const tabs = page
    .getByRole("tablist", { name: "Reply status" })
    .getByRole("tab");
  await expect(tabs).toHaveCount(5);

  const rights = await tabs.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().right),
  );
  const info = (await page
    .getByRole("button", { name: "About reply status" })
    .boundingBox())!;
  const title = (await page.getByText("Stürzt ab").boundingBox())!;

  expect(Math.max(...rights, info.x + info.width)).toBeLessThanOrEqual(320);
  expect(title.width).toBeGreaterThan(80);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
