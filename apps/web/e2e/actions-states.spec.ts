import type { BrowserContext, Page } from "@playwright/test";
import { CROWDED_COOKIE, RTL_KEYWORD } from "./actions-fixtures.mts";
import { expect, test } from "./session.mts";

const cookie = (name: string, value: string) => ({
  name,
  value,
  url: "http://localhost:3000",
});

const crowd = (context: BrowserContext) =>
  context.addCookies([cookie(CROWDED_COOKIE, "1")]);

const region = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

test("start here names the top action, its steps and where to fix it", async ({
  page,
}) => {
  await page.goto("/actions");
  const start = region(page, "Start here");
  const top = page.locator("#queue li[id^='action-']").first();

  await expect(start.getByRole("listitem").first()).toBeVisible();
  expect(await start.getByRole("listitem").count()).toBeGreaterThanOrEqual(2);
  await expect(
    start.getByRole("link", { name: /^Fix it in / }),
  ).toHaveAttribute("href", /^\/apps\//);
  await expect(start).toContainText(
    (await top.getByRole("link").first().textContent()) ?? "",
  );

  await start.getByRole("button", { name: "See the evidence" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/action=/);
});

test("start here belongs to the to do list only", async ({ page }) => {
  await page.goto("/actions?status=DISMISSED");

  await expect(region(page, "Queue")).toBeVisible();
  expect(await region(page, "Start here").count()).toBe(0);
});

test("a row says why its action is there", async ({ page }) => {
  await page.goto("/actions?status=DISMISSED");

  await expect(page.locator("[id='action-act-dismissed']")).toContainText(
    "Ranked on 1 of 35 checks · volume 2 · saves 1 request a day",
  );
});

test("the open work can be split by type and filters the queue", async ({
  page,
}) => {
  await page.goto("/actions");
  const where = region(page, "Where the work is");

  await where.getByRole("tab", { name: "Type" }).click();
  const first = where.getByRole("link").first();
  await expect(first).toHaveAccessibleName(/^\w+, \d+ open$/);
  await first.click();

  await expect(page).toHaveURL(/category=/);
  await expect(where.getByRole("tab", { name: "Type" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("a crowded workspace folds the apps past the fifth and waits for history", async ({
  page,
  context,
}) => {
  await crowd(context);
  await page.goto("/actions");
  const where = region(page, "Where the work is");

  await expect(where.getByRole("link")).toHaveCount(5);
  await expect(where.getByText("and 2 more")).toBeVisible();
  await expect(
    region(page, "Progress").getByText("Not enough history yet"),
  ).toBeVisible();
});

test("a right to left keyword keeps its row inside a phone screen", async ({
  page,
  context,
}) => {
  await crowd(context);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/actions");

  await expect(
    page.getByRole("link", { name: new RegExp(RTL_KEYWORD) }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test("a cleared queue has nothing to start with and says so", async ({
  page,
  context,
}) => {
  await context.addCookies([
    cookie("e2e_actions_ungenerated", "1"),
    cookie("actions_generated_at", "2026-07-30T03:00:00.000Z"),
  ]);
  await page.goto("/actions");

  await expect(
    region(page, "Queue").getByText("Nothing to do right now"),
  ).toBeVisible();
  expect(await region(page, "Start here").count()).toBe(0);
  await expect(
    region(page, "Where the work is").getByText("Nothing open."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate now" })).toHaveCount(
    1,
  );
});
