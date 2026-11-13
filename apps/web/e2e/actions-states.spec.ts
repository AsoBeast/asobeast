import type { BrowserContext, Page } from "@playwright/test";
import { CROWDED_COOKIE, RTL_KEYWORD } from "./actions-fixtures.mts";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const TOP_ACTION = 'Add "habit tracker" to your metadata';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

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

  await expect(start.getByText(TOP_ACTION, { exact: true })).toBeVisible();
  await expect(start.getByRole("listitem")).toHaveText([
    "1Open the metadata workbench",
    /^2Put "habit tracker" in the subtitle, or in the keyword field/,
    "3Ship the change with your next release",
    /^4AsoBeast confirms the fix/,
  ]);
  await expect(
    start.getByRole("link", { name: "Fix it in Metadata" }),
  ).toHaveAttribute("href", "/apps/app-1/metadata?keyword=kw-1");

  await start.getByRole("button", { name: "See the evidence" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/action=/);
});

test("start here belongs to the to do list only", async ({ page }) => {
  await page.goto("/actions?status=DISMISSED");

  await expect(page.locator("[id='action-act-dismissed']")).toBeVisible();
  await expect(region(page, "Start here")).toHaveCount(0);
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
  await expect(first).toHaveAccessibleName(/^\w+, (\d+ \w+, )*\d+ open$/);
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

  const row = page.locator("[id='action-act-crowd-1']");
  await expect(
    row.getByRole("link", { name: new RegExp(RTL_KEYWORD) }),
  ).toBeVisible();
  expect(
    await row.evaluate(
      (node) =>
        node.scrollWidth <= node.clientWidth &&
        [...node.querySelectorAll("*")].every(
          (child) =>
            child.getBoundingClientRect().right <=
            node.getBoundingClientRect().right + 1,
        ),
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
  await expect(region(page, "Start here")).toHaveCount(0);
  await expect(
    region(page, "Where the work is").getByText("Nothing open."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate now" })).toHaveCount(
    1,
  );
});
