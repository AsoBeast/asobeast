import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_1_CHANGE_IMPACT } from "./fixtures.mts";
import { formatDate } from "../src/lib/format";

const [RECENT, MEASURED, OLDER, UNANCHORED] = APP_1_CHANGE_IMPACT.items;

const impactCard = (page: Page) =>
  page.getByRole("region", { name: "How rankings moved after each change" });

const changeRow = (page: Page, changedOn: string) =>
  impactCard(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", { level: 3, name: formatDate(changedOn) }),
    });

const windowTile = (page: Page, changedOn: string, days: number) =>
  changeRow(page, changedOn)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", { level: 4, name: `After ${days} days` }),
    });

test("the impact card lists every change newest first above the timeline", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const card = impactCard(page);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText(
    APP_1_CHANGE_IMPACT.items.map((item) => formatDate(item.changedOn)),
  );
  await expect(card).toContainText(
    "4 changes to your listing in the last 90 days",
  );
  const recent = changeRow(page, RECENT.changedOn);
  await expect(recent.getByText("Title", { exact: true })).toBeVisible();
  await expect(recent.getByText("Description", { exact: true })).toBeVisible();

  const cardBox = await card.boundingBox();
  const timelineBox = await page
    .getByText("Metadata change timeline")
    .boundingBox();
  expect(cardBox?.y).toBeLessThan(timelineBox?.y ?? 0);
});

test("pending windows say when they become measurable", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  for (const impact of RECENT.windows) {
    await expect(windowTile(page, RECENT.changedOn, impact.days)).toContainText(
      `Measurable on ${formatDate(impact.targetDate)}`,
    );
  }
});

test("a measured window shows the visibility and keyword movement", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const [week] = MEASURED.windows;
  const tile = windowTile(page, MEASURED.changedOn, 7);
  await expect(tile).toContainText(
    `Measured on ${formatDate(week.measuredOn)}`,
  );
  for (const text of [
    "38.4 → 42.1",
    "2 improved, 1 declined",
    "1 started ranking",
    "5 keywords checked on both days",
  ]) {
    await expect(tile).toContainText(text);
  }
  await expect(tile.getByLabel("up 3.7 in visibility")).toBeVisible();
  await expect(tile.getByLabel("up 3 positions")).toBeVisible();
});

test("a window names the later change that falls inside it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  await expect(windowTile(page, MEASURED.changedOn, 14)).toContainText(
    `Another change on ${formatDate(RECENT.changedOn)} falls inside this window.`,
  );
});

test("unmeasured windows and unanchored changes say why", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  const [, fortnight] = OLDER.windows;
  await expect(windowTile(page, OLDER.changedOn, 14)).toContainText(
    `No rank check near ${formatDate(fortnight.targetDate)}`,
  );
  const unanchored = changeRow(page, UNANCHORED.changedOn);
  await expect(unanchored).toContainText(
    "No rank check just before this change",
  );
  await expect(unanchored.getByRole("heading", { level: 4 })).toHaveCount(0);
});

test("the timeline window drives the impact report", async ({ page }) => {
  await page.goto("/apps/app-1/changes");
  await expect(
    impactCard(page).getByRole("heading", { level: 3 }).first(),
  ).toBeVisible();

  const request = page.waitForRequest((sent) => {
    const url = new URL(sent.url());
    return (
      url.pathname === "/api/backend/apps/app-1/changes/impact" &&
      url.searchParams.get("days") === "30" &&
      url.searchParams.get("country") === "us"
    );
  });
  await page.getByRole("tab", { name: "30d" }).click();
  await request;

  await expect(page).toHaveURL(/days=30/);
  await expect(impactCard(page)).toContainText("in the last 30 days");
});

test("a market without keywords explains what to track", async ({ page }) => {
  await page.goto("/apps/app-2/changes");

  await expect(impactCard(page)).toContainText(
    "No keywords tracked in United States yet",
  );
});

test("an app without changes says so for the window", async ({ page }) => {
  await page.goto("/apps/app-gp/changes");

  await expect(impactCard(page)).toContainText(
    "No changes to your listing in the last 90 days",
  );
});

test("a second market can be picked and is kept in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const market = page.getByRole("combobox", { name: "Market" });
  await expect(market).toHaveText("US · United States");
  await market.click();
  await page.getByRole("option", { name: "PL · Poland" }).click();

  await expect(page).toHaveURL(/country=pl/);
  await expect(impactCard(page)).toContainText(
    "No keywords tracked in Poland yet",
  );
});

test("a market deep link opens on it and the home market clears the key", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?country=pl");

  const market = page.getByRole("combobox", { name: "Market" });
  await expect(market).toHaveText("PL · Poland");
  await expect(impactCard(page)).toContainText(
    "No keywords tracked in Poland yet",
  );

  await market.click();
  await page.getByRole("option", { name: "US · United States" }).click();

  await expect(page).not.toHaveURL(/country=/);
  await expect(
    impactCard(page).getByRole("heading", { level: 3 }).first(),
  ).toBeVisible();
});

test("a single market app has no picker and measures its home market", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/changes");
  await expect(impactCard(page)).toContainText("No changes to your listing");
  await expect(page.getByRole("combobox", { name: "Market" })).toHaveCount(0);

  const request = page.waitForRequest((sent) => {
    const url = new URL(sent.url());
    return (
      url.pathname === "/api/backend/apps/app-gp/changes/impact" &&
      url.searchParams.get("country") === "de"
    );
  });
  await page.getByRole("tab", { name: "30d" }).click();
  await request;
});
