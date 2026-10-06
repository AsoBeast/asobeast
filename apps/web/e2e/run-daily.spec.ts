import { APP_1_DETAIL } from "./fixtures.mts";
import { expect, test } from "./session.mts";

const RUN_DAILY = "**/api/backend/apps/*/run-daily";

const answer = (enqueued: {
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
}) => ({ status: 202, json: { enqueued } });

test.describe("Run daily", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/apps/${APP_1_DETAIL.id}`);
  });

  test("says nothing was queued when today's work is already queued or done", async ({
    page,
  }) => {
    await page.route(RUN_DAILY, (route) =>
      route.fulfill(
        answer({ apps: 0, keywords: 0, categories: 0, reviews: 0 }),
      ),
    );

    await page.getByRole("button", { name: "Run daily" }).click();

    await expect(page.getByText("Nothing new to queue")).toBeVisible();
    await expect(page.getByText(/^Queued ·/)).toHaveCount(0);
  });

  test("counts the keywords it queued again", async ({ page }) => {
    await page.route(RUN_DAILY, (route) =>
      route.fulfill(
        answer({ apps: 0, keywords: 3, categories: 0, reviews: 0 }),
      ),
    );

    await page.getByRole("button", { name: "Run daily" }).click();

    await expect(
      page.getByText("Queued · rank checks for 3 keywords"),
    ).toBeVisible();
  });

  test("names the jobs when no keyword was queued again", async ({ page }) => {
    await page.route(RUN_DAILY, (route) =>
      route.fulfill(
        answer({ apps: 1, keywords: 0, categories: 0, reviews: 1 }),
      ),
    );

    await page.getByRole("button", { name: "Run daily" }).click();

    await expect(page.getByText("Queued · 2 jobs")).toBeVisible();
  });

  test("promises no search rate, which differs per store and proxy pool", async ({
    page,
  }) => {
    await page.route(RUN_DAILY, (route) =>
      route.fulfill(
        answer({ apps: 0, keywords: 3, categories: 0, reviews: 0 }),
      ),
    );

    await page.getByRole("button", { name: "Run daily" }).click();

    await expect(
      page.getByText("Queued · rank checks for 3 keywords"),
    ).toBeVisible();
    expect(await page.getByText(/searches\/minute/).count()).toBe(0);
    await expect(
      page.getByText(
        "The rate-limited worker runs it in the background. Results appear as the cache refetches.",
      ),
    ).toBeVisible();
  });
});
