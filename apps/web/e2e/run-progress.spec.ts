import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const RUN_PROGRESS_POLL_MS = 10_000;

const requestsTo = (page: Page, path: string): (() => number) => {
  let count = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === path) count += 1;
  });
  return () => count;
};

test("a running app shows its progress pill and the stages", async ({
  page,
}) => {
  await page.goto("/apps/app-new");

  const pill = page.getByRole("button", {
    name: "Today's run: 6 of 12 checks done",
  });
  await expect(pill).toContainText("6 of 12");
  await pill.click();

  const run = page.getByRole("dialog", { name: "Today’s run" });
  await expect(run).toBeVisible();
  await expect(run.getByText(/^Started /)).toBeVisible();
  const stages = run.getByRole("listitem");
  await expect(stages).toHaveCount(3);
  await expect(stages.nth(0)).toContainText("Listings captured");
  await expect(stages.nth(0)).toContainText("Collecting · 2 of 3");
  await expect(stages.nth(1)).toContainText("Positions checked");
  await expect(stages.nth(1)).toContainText("Collecting · 3 of 8");
  await expect(stages.nth(2)).toContainText("Charts read");
  await expect(stages.nth(2)).toContainText("Done");
  await expect(
    run.getByText("Run daily queues what is still missing."),
  ).toBeVisible();
});

test("announces the run on a phone where the count is hidden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/apps/app-new");

  await expect(
    page.getByRole("status").filter({ hasText: "Today's run:" }),
  ).toHaveText("Today's run: 6 of 12 checks done");
});

test("a complete app says so and an idle app shows nothing", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  await expect(
    page.getByRole("button", { name: "Today's run complete" }),
  ).toBeVisible();

  await page.goto("/apps/app-2");
  await expect(page.getByRole("button", { name: "Run daily" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Today's run/ })).toHaveCount(
    0,
  );
});

test("a delayed run is named", async ({ page, context }) => {
  await seedCookies(context, { e2e_app_run_delayed: "1" });

  await page.goto("/apps/app-new");

  await expect(
    page.getByRole("button", {
      name: "Today's run delayed: 9 of 12 checks done",
    }),
  ).toContainText("Run delayed");
});

test("the pill follows the run and refreshes the keywords", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_app_run_advance: randomUUID() });
  const keywords = requestsTo(page, "/api/backend/apps/app-new/keywords");

  await page.goto("/apps/app-new/keywords");
  const running = page.getByRole("button", {
    name: "Today's run: 6 of 12 checks done",
  });
  await expect(running).toBeVisible();
  const before = keywords();

  await expect(
    page.getByRole("button", { name: "Today's run complete" }),
  ).toBeVisible({ timeout: RUN_PROGRESS_POLL_MS + 5_000 });
  await expect.poll(keywords).toBeGreaterThan(before);
});

test("run daily refreshes the pill at once", async ({ page }) => {
  const runStatus = requestsTo(page, "/api/backend/apps/app-1/run-status");
  await page.goto("/apps/app-1");
  await expect(
    page.getByRole("button", { name: "Today's run complete" }),
  ).toBeVisible();
  const before = runStatus();

  await page.getByRole("button", { name: "Run daily" }).click();

  await expect.poll(runStatus, { timeout: 2_000 }).toBeGreaterThan(before);
});

test("a paused run shows no pill and is not polled", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_app_run_paused: "1" });
  const runStatus = requestsTo(page, "/api/backend/apps/app-new/run-status");

  await page.goto("/apps/app-new");
  await expect(page.getByRole("button", { name: "Run daily" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Today's run/ })).toHaveCount(
    0,
  );
  await expect.poll(runStatus).toBe(1);
  await page.waitForTimeout(RUN_PROGRESS_POLL_MS + 1_500);

  expect(runStatus()).toBe(1);
});

test("a run that completed before the pause keeps its pill", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_app_run_paused: "1" });

  await page.goto("/apps/app-1");

  await expect(
    page.getByRole("button", { name: "Today's run complete" }),
  ).toBeVisible();
});
