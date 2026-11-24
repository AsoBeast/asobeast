import type { Locator, Page } from "@playwright/test";
import type { SpiderStatus } from "@asobeast/shared";
import { APP_TICKS_DETAIL } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const APP = APP_TICKS_DETAIL.id;
const SEED = "focus timer";
const SPIDER_URL = new RegExp(
  `/api/backend/apps/${APP}/keywords/spider(\\?.*)?$`,
);
const TRACK_REQUEST = new RegExp(`/api/backend/apps/${APP}/keywords$`);

const STATUS: SpiderStatus = {
  term: SEED,
  probesDone: 27,
  probesTotal: 27,
  complete: true,
  suggestions: [
    "focus timer free",
    "focus timer for study",
    "focus timer widget",
    "focus timer kids",
    "focus timer dark",
    "focus timer sound",
  ].map((text) => ({ text, priority: null, probes: 1 })),
};

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords/${APP}`, {
    failOnStatusCode: true,
  });
});

async function routeSpider(page: Page, started = false): Promise<void> {
  let ran = started;
  const idle: SpiderStatus = {
    ...STATUS,
    probesDone: 0,
    complete: false,
    suggestions: [],
  };
  await page.route(SPIDER_URL, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill(fulfillJson(200, ran ? STATUS : idle));
    }
    ran = true;
    return route.fulfill(fulfillJson(202, { queued: 27, skipped: 0 }));
  });
}

const rowMenu = (page: Page): Locator =>
  page.getByRole("button", {
    name: `Keyword actions for ${SEED}`,
    exact: true,
  });

const panel = (page: Page): Locator =>
  page.locator('[data-slot="card"]').filter({
    has: page.getByRole("heading", { name: "Suggestions", exact: true }),
  });

test("Ideas on a keyword row opens suggestions seeded with it and tracks two", async ({
  page,
}) => {
  await routeSpider(page);
  const bodies: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && TRACK_REQUEST.test(request.url())) {
      bodies.push(request.postDataJSON());
    }
  });

  await page.goto(`/apps/${APP}/keywords`);
  const menu = await hydrated(rowMenu(page));
  await menu.click();
  await page.getByRole("menuitem", { name: "Ideas" }).click();

  await expect(page).toHaveURL(
    /[?&]ideas=focus\+timer|[?&]ideas=focus%20timer/,
  );
  const ideas = panel(page);
  const heading = ideas.getByRole("heading", { name: `Ideas for “${SEED}”` });
  await expect(heading).toBeFocused();
  await expect(ideas).toContainText("in United States");

  await ideas.getByRole("button", { name: "Find ideas" }).click();
  await expect(ideas.getByRole("listitem").first()).toBeVisible();

  await ideas.getByRole("checkbox", { name: "focus timer free" }).check();
  await ideas.getByRole("checkbox", { name: "focus timer widget" }).check();
  await ideas.getByRole("button", { name: "Track 2 selected" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toEqual({
    keywords: ["focus timer free", "focus timer widget"],
    country: "us",
  });

  await ideas.getByRole("button", { name: "Close ideas" }).click();
  await expect(page).not.toHaveURL(/ideas=/);
  await expect(rowMenu(page)).toBeFocused();
});

test("Add top ticks the first five rows that are not tracked", async ({
  page,
}) => {
  await routeSpider(page, true);
  await page.goto(`/apps/${APP}/keywords?ideas=${encodeURIComponent(SEED)}`);
  const ideas = panel(page);
  await expect(ideas.getByRole("listitem").first()).toBeVisible();
  await hydrated(ideas.getByRole("button", { name: "Add top 5" })).then(
    (button) => button.click(),
  );
  await expect(ideas.getByRole("checkbox", { checked: true })).toHaveCount(5);
  await expect(
    ideas.getByRole("button", { name: "Track 5 selected" }),
  ).toBeVisible();
});
