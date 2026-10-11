import type { Locator, Page } from "@playwright/test";
import type {
  ApiErrorEnvelope,
  SpiderEnqueueResult,
  SpiderStatus,
} from "@asobeast/shared";
import { hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";

const SPIDER_URL = /\/api\/backend\/apps\/app-1\/keywords\/spider(\?.*)?$/;

const REFUSAL: ApiErrorEnvelope = {
  statusCode: 429,
  error: "Too Many Requests",
  message:
    "Deep search limit reached: the indie plan allows 12 requests per day. Try again in 3 hours 12 minutes.",
  path: "/apps/app-1/keywords/spider",
  timestamp: "2026-10-17T10:00:00.000Z",
  rateLimit: {
    window: "day",
    rateClass: "store",
    plan: "indie",
    limit: 12,
    resetSeconds: 11_520,
    upgradeTo: "ultimate",
    action: "spider",
  },
  retryAfterSeconds: 11_520,
};

const STATUS: SpiderStatus = {
  term: "habit tracker",
  probesDone: 0,
  probesTotal: 27,
  complete: false,
  suggestions: [],
};

const toast = (page: Page, text: string | RegExp) =>
  page.getByRole("region", { name: /^Notifications/ }).getByText(text);

const activateTwiceInOneTask = async (control: Locator) =>
  (await hydrated(control)).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });

async function routeSpider(
  page: Page,
  start: { status: number; body: unknown },
) {
  const starts: string[] = [];
  await page.route(SPIDER_URL, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill(fulfillJson(200, STATUS));
      return;
    }
    starts.push(route.request().url());
    await route.fulfill(fulfillJson(start.status, start.body));
  });
  return starts;
}

async function openDeepSearch(page: Page) {
  await page.goto("/apps/app-1/keywords");
  await (
    await hydrated(page.getByRole("button", { name: /^Suggestions/ }))
  ).click();
  await (
    await hydrated(page.getByRole("button", { name: "Deep search" }))
  ).click();
  const dialog = page.getByRole("dialog", { name: "Deep search" });
  await dialog.getByLabel("Seed term").fill("habit tracker");
  return dialog.getByRole("button", { name: "Start" });
}

test("a spent deep search allowance is explained in a toast and the dialog stays open", async ({
  page,
}) => {
  const starts = await routeSpider(page, { status: 429, body: REFUSAL });
  const start = await openDeepSearch(page);

  await start.click();

  await expect(toast(page, REFUSAL.message)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Deep search" })).toBeVisible();
  await expect(start).toBeEnabled();
  expect(starts).toHaveLength(1);
});

test("two activations of Start in one task send one deep search", async ({
  page,
}) => {
  const queued: SpiderEnqueueResult = { enqueued: 27 };
  const starts = await routeSpider(page, { status: 202, body: queued });
  const start = await openDeepSearch(page);

  await activateTwiceInOneTask(start);

  await expect(toast(page, /^Queued ·/)).toHaveCount(1);
  expect(starts).toHaveLength(1);
});
