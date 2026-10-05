import type { Locator, Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const countPosts = (page: Page, path: RegExp) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && path.test(request.url())) {
      seen.push(request.url());
    }
  });
  return seen;
};

const toast = (page: Page, text: string | RegExp) =>
  page.getByRole("region", { name: /^Notifications/ }).getByText(text);

const activateTwiceInOneTask = async (control: Locator) =>
  (await hydrated(control)).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });

const RUN_DAILY_URL = /\/api\/backend\/apps\/app-1\/run-daily$/;
const SCORE_URL = /\/api\/backend\/keywords\/[^/]+\/score$/;

test.describe("on demand actions send one request per click", () => {
  test("a double click on Run daily sends one request", async ({ page }) => {
    const posts = countPosts(page, RUN_DAILY_URL);
    await page.goto("/apps/app-1");

    await (
      await hydrated(page.getByRole("button", { name: "Run daily" }))
    ).dblclick();

    await expect(toast(page, /^Queued ·/)).toHaveCount(1);
    expect(posts).toHaveLength(1);
  });

  test("two activations of Run daily in one task send one request", async ({
    page,
  }) => {
    const posts = countPosts(page, RUN_DAILY_URL);
    await page.goto("/apps/app-1");

    await activateTwiceInOneTask(
      page.getByRole("button", { name: "Run daily" }),
    );

    await expect(toast(page, /^Queued ·/)).toHaveCount(1);
    expect(posts).toHaveLength(1);
  });

  test("Run daily sends again once the first request has settled", async ({
    page,
  }) => {
    const posts = countPosts(page, RUN_DAILY_URL);
    await page.goto("/apps/app-1");
    const button = await hydrated(
      page.getByRole("button", { name: "Run daily" }),
    );

    await button.click();
    await expect(toast(page, /^Queued ·/)).toHaveCount(1);
    await expect(button).toBeEnabled();
    await button.click();

    await expect.poll(() => posts.length).toBe(2);
  });

  test("two activations of Score now in one task send one request", async ({
    page,
  }) => {
    const posts = countPosts(page, SCORE_URL);
    await page.goto("/apps/app-1/keywords");
    await (
      await hydrated(
        page.getByRole("button", { name: "Keyword actions" }).first(),
      )
    ).click();

    await activateTwiceInOneTask(
      page.getByRole("menuitem", { name: "Score now" }),
    );

    await expect(toast(page, /^Queued · scoring$/)).toHaveCount(1);
    expect(posts).toHaveLength(1);
  });

  test("Score now stays disabled while its request is pending after the keywords page remounts", async ({
    page,
  }) => {
    let releaseScore!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseScore = resolve;
    });
    await page.route(SCORE_URL, async (route) => {
      await held;
      await route.continue();
    });
    const posts = countPosts(page, SCORE_URL);
    const sections = page.getByRole("navigation", { name: "App sections" });
    const openFirstRowMenu = async () =>
      (
        await hydrated(
          page.getByRole("button", { name: "Keyword actions" }).first(),
        )
      ).click();
    await page.goto("/apps/app-1/keywords");

    await openFirstRowMenu();
    await page.getByRole("menuitem", { name: "Score now" }).click();
    await expect.poll(() => posts.length).toBe(1);
    await sections.getByRole("link", { name: "Rankings", exact: true }).click();
    await expect(page).toHaveURL(/\/apps\/app-1\/rankings$/);
    await sections.getByRole("link", { name: "Keywords", exact: true }).click();
    await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
    await openFirstRowMenu();

    await expect(
      page.getByRole("menuitem", { name: "Score now" }),
    ).toBeDisabled();
    releaseScore();
    await expect(toast(page, /^Queued · scoring$/)).toHaveCount(1);
    expect(posts).toHaveLength(1);
  });
});
