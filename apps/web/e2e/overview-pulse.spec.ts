import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const tile = (page: Page, name: RegExp) => page.getByRole("button", { name });

const figures = (page: Page) =>
  page
    .locator('[data-slot="stat-tile-group"]')
    .first()
    .locator('[data-slot="stat-tile"]');

const movers = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Keyword movers" }) });

const moverRows = (page: Page) =>
  movers(page).getByRole("list").first().getByRole("listitem");

test("each figure draws its own chart and keeps it in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  await expect(tile(page, /^Visibility/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await (await hydrated(tile(page, /^Keywords in top 10/))).click();

  await expect(page).toHaveURL(/visView=top10/);
  await expect(
    page.getByRole("region", { name: "Tracked keywords by rank band" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Keywords in each rank band today" }),
  ).toHaveText("#11#2–31#4–101#11–501#51+0Unranked1");
  await expect(tile(page, /^Visibility/)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a share of voice link on an app without a measured share keeps the figure and says why", async ({
  page,
}) => {
  await page.goto("/apps/app-gp?visView=share");

  await expect(figures(page)).toHaveCount(4);
  await expect(tile(page, /^Share of voice/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(tile(page, /^Share of voice/)).toContainText(
    "Your competitors have not been checked yet",
  );
  await expect(page.getByText("No share of voice recorded yet")).toBeVisible();
});

test("the rating figure draws the rating of the home listing", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const rating = figures(page).filter({ hasText: /^Rating/ });
  await expect(rating.locator('[data-slot="delta-pill"]')).toContainText("7d");

  await (await hydrated(rating)).click();

  await expect(page).toHaveURL(/visView=rating/);
  await expect(
    page.getByRole("heading", { name: "Rating on the home listing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Average rating over time" }),
  ).toBeVisible();
});

test("the rating figure of another market carries no change of the home listing", async ({
  page,
}) => {
  await page.goto("/apps/app-1?market=pl");
  const rating = figures(page).filter({ hasText: /^Rating/ });

  await expect(rating).toContainText("ratings");
  await expect(rating.locator('[data-slot="delta-pill"]')).toHaveCount(0);
});

test("the visibility chart compares with the range before and marks listing changes", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const key = page.getByRole("list", { name: "Chart lines" });

  await expect(key.getByRole("listitem")).toHaveText([
    "Last 30 days",
    "Previous 30 days",
    "Listing change",
  ]);
  await expect(
    page.getByRole("link", { name: "See what each change did" }),
  ).toHaveAttribute("href", "/apps/app-1/changes");
  await expect(
    page.getByRole("heading", { name: "Search visibility", exact: true }),
  ).toBeVisible();
});

test("the link under the chart keeps the chosen market", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await expect(
    page.getByRole("link", { name: "See what each change did" }),
  ).toHaveAttribute("href", "/apps/app-1/changes?market=pl");
});

test("a failed listing changes read leaves the chart up and offers a retry", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/api/backend/apps/app-1/changes?*", (route) =>
    route.fulfill({ status: 500, json: { message: "down" } }),
  );
  await page.goto("/apps/app-1");

  await expect(
    page.getByRole("region", { name: "Search visibility over time" }),
  ).toBeVisible();
  await expect(
    page.getByText("The listing changes could not be loaded."),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("link", { name: "See what each change did" }),
  ).toHaveCount(0);
});

test("the keywords closest to the top 10 follow the movers", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const near = page.getByRole("list", { name: "Closest to the top 10" });

  await expect(near.getByRole("listitem")).toHaveText(["pomodoroUS122 places"]);
  await expect(near.getByRole("link")).toHaveAttribute(
    "href",
    "/apps/app-1/rankings?keywords=kw-2",
  );
});

test("each mover row draws its last 30 days of positions", async ({ page }) => {
  await page.goto("/apps/app-1");

  await expect(
    moverRows(page).getByRole("img", { name: /^position, last 30 days/ }),
  ).toHaveCount(2);
});

test("metadata coverage counts each field against the tracked keywords", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const coverage = page.getByLabel("Tracked keywords found in each field");

  await expect(coverage).toContainText("Title2 of 5");
  await expect(coverage).toContainText("Subtitle1 of 5");
  await expect(coverage).toContainText("Description3 of 5");
});

test("metadata coverage keeps counting every market while one is chosen", async ({
  page,
}) => {
  await page.goto("/apps/app-1?market=pl");
  const coverage = page.getByLabel("Tracked keywords found in each field");

  await expect(coverage).toContainText("Title2 of 5");
  await expect(
    page.locator('[data-slot="stat-tile"]').filter({ hasText: "in top 10" }),
  ).toContainText("of 2 tracked");
});

test("the movers narrow to climbers or fallers and keep the choice in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const card = movers(page);
  await expect(moverRows(page)).toHaveCount(2);

  await (await hydrated(card.getByRole("tab", { name: "Fallers" }))).click();

  await expect(page).toHaveURL(/movers=down/);
  await expect(moverRows(page)).toHaveText(["pomodoro6 → 126down 6 in 7 days"]);

  await card.getByRole("tab", { name: "Climbers" }).click();

  await expect(page).toHaveURL(/movers=up/);
  await expect(moverRows(page)).toHaveText([
    "focus timer10 → 37up 7 in 7 days",
  ]);
});

test("a market where nothing moved says so and offers no tabs", async ({
  page,
}) => {
  await page.goto("/apps/app-1?market=pl");
  const card = movers(page);

  await expect(card).toContainText("No keyword moved in the last 7 days.");
  await expect(card.getByRole("tablist")).toHaveCount(0);
});

test("the facts under the app header read at the size of the dashboard status line", async ({
  page,
}) => {
  await page.goto("/");
  const status = await page
    .locator("[data-slot=portfolio-status]")
    .evaluate((node) => getComputedStyle(node).fontSize);

  await page.goto("/apps/app-1");
  const facts = await page
    .getByText(/^Snapshot /)
    .evaluate((node) => getComputedStyle(node.closest("ul") ?? node).fontSize);

  expect(facts).toBe(status);
});
