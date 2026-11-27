import type { APIRequestContext, Locator, Page } from "@playwright/test";
import type { SpiderEnqueueResult, SpiderStatus } from "@asobeast/shared";
import { APP_TICKS_DETAIL, APP_TICKS_RIVAL_ID } from "./fixtures.mts";
import { holdRequest, pressFromKeyboard } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const APP = APP_TICKS_DETAIL.id;
const SEED = "focus timer";
const spiderUrl = (app: string): RegExp =>
  new RegExp(`/api/backend/apps/${app}/keywords/spider(\\?.*)?$`);
const SPIDER_URL = spiderUrl(APP);
const TRACK_REQUEST = new RegExp(`/api/backend/apps/${APP}/keywords$`);

const OTHER = "study timer";
const TOO_LONG = "a focus timer phrase that runs well past forty characters";

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
  for (const app of [APP, APP_TICKS_RIVAL_ID]) {
    await request.post(`${MOCK_API_URL}/__reset/keywords/${app}`, {
      failOnStatusCode: true,
    });
  }
});

async function trackMoreRows(request: APIRequestContext): Promise<void> {
  await request.post(`${MOCK_API_URL}/apps/${APP}/keywords`, {
    data: { keywords: [OTHER, TOO_LONG], country: "us" },
    failOnStatusCode: true,
  });
}

async function routeSpider(
  page: Page,
  started = false,
  posts: unknown[] = [],
  app = APP,
): Promise<void> {
  const ran = new Set<string>(started ? [SEED] : []);
  const idle: SpiderStatus = {
    ...STATUS,
    probesDone: 0,
    complete: false,
    suggestions: [],
  };
  await page.route(spiderUrl(app), (route) => {
    if (route.request().method() === "GET") {
      const term = new URL(route.request().url()).searchParams.get("term");
      return route.fulfill(
        fulfillJson(200, term && ran.has(term) ? { ...STATUS, term } : idle),
      );
    }
    const body = route.request().postDataJSON() as { term: string };
    ran.add(body.term);
    posts.push(body);
    const result: SpiderEnqueueResult = { enqueued: 27 };
    return route.fulfill(fulfillJson(202, result));
  });
}

const rowMenu = (page: Page): Locator =>
  page.getByRole("button", {
    name: `Keyword actions for ${SEED}`,
    exact: true,
  });

const openIdeasFrom = async (menu: Locator): Promise<void> => {
  await (await hydrated(menu)).click();
  await menu.page().getByRole("menuitem", { name: "Ideas" }).click();
};

const panel = (page: Page): Locator =>
  page.locator('[data-slot="card"]').filter({
    has: page.getByRole("heading", { name: "Suggestions", exact: true }),
  });

test("Ideas on a keyword row opens suggestions seeded with it and tracks two", async ({
  page,
}) => {
  const spiderPosts: unknown[] = [];
  await routeSpider(page, false, spiderPosts);
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
  expect(spiderPosts).toEqual([{ term: SEED, country: "us" }]);

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

test("Select top ticks the first five rows that are not tracked", async ({
  page,
}) => {
  await routeSpider(page, true);
  await page.goto(`/apps/${APP}/keywords?ideas=${encodeURIComponent(SEED)}`);
  const ideas = panel(page);
  await expect(ideas.getByRole("listitem").first()).toBeVisible();
  await hydrated(ideas.getByRole("button", { name: "Select top 5" })).then(
    (button) => button.click(),
  );
  await expect(ideas.getByRole("checkbox", { checked: true })).toHaveCount(5);
  await expect(
    ideas.getByRole("button", { name: "Track 5 selected" }),
  ).toBeVisible();
});

test("Ideas on a second row starts fresh and Back returns focus to the row", async ({
  page,
  request,
}) => {
  await trackMoreRows(request);
  await routeSpider(page);
  await page.goto(`/apps/${APP}/keywords`);
  await openIdeasFrom(rowMenu(page));
  const ideas = panel(page);
  await ideas.getByRole("button", { name: "Find ideas" }).click();
  await expect(ideas.getByRole("listitem").first()).toBeVisible();

  const other = page.getByRole("button", {
    name: `Keyword actions for ${OTHER}`,
    exact: true,
  });
  await openIdeasFrom(other);
  await expect(
    ideas.getByRole("heading", { name: `Ideas for “${OTHER}”` }),
  ).toBeFocused();
  await expect(ideas.getByRole("button", { name: "Find ideas" })).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/ideas=/);
  await expect(other).toBeFocused();
});

test("Close ideas leaves no entry behind, so Back leaves the page", async ({
  page,
}) => {
  await routeSpider(page);
  await page.goto("about:blank");
  await page.goto(`/apps/${APP}/keywords`);
  await openIdeasFrom(rowMenu(page));
  await expect(page).toHaveURL(/ideas=/);

  await panel(page).getByRole("button", { name: "Close ideas" }).click();
  await expect(page).not.toHaveURL(/ideas=/);
  await expect(rowMenu(page)).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});

test("Close ideas after a tab switch keeps the tab it was closed on", async ({
  page,
}) => {
  await routeSpider(page);
  await page.goto(`/apps/${APP}/keywords`);
  await openIdeasFrom(rowMenu(page));
  await expect(page).toHaveURL(/ideas=/);

  await page.getByRole("tab", { name: /^Discovered/ }).click();
  await expect(page).toHaveURL(/tab=discovered/);
  await panel(page).getByRole("button", { name: "Close ideas" }).click();

  await expect(page).not.toHaveURL(/ideas=/);
  await expect(page).toHaveURL(/tab=discovered/);
  await expect(
    page.getByRole("button", { name: "Suggestions", exact: true }),
  ).toBeFocused();
});

test("closing Ideas from a section heading that stays returns focus to the row", async ({
  page,
}) => {
  await routeSpider(page, false, [], APP_TICKS_RIVAL_ID);
  await page.goto(`/apps/${APP_TICKS_RIVAL_ID}/keywords`);
  await openIdeasFrom(rowMenu(page));
  const toggle = page.getByRole("button", {
    name: "Suggestions",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/ideas=/);
  await expect(rowMenu(page)).toBeFocused();
});

test("a bulk track still sending blocks another after Ideas closes and opens", async ({
  page,
}) => {
  await routeSpider(page, true);
  let posts = 0;
  const held = await holdRequest(page, TRACK_REQUEST, "POST");
  page.on("request", (request) => {
    if (request.method() === "POST" && TRACK_REQUEST.test(request.url())) {
      posts += 1;
    }
  });
  await page.goto(`/apps/${APP}/keywords`);
  const ideas = panel(page);
  const tickAndTrack = async (): Promise<Locator> => {
    await openIdeasFrom(rowMenu(page));
    await ideas.getByRole("checkbox", { name: "focus timer free" }).check();
    const track = ideas.getByRole("button", { name: "Track 1 selected" });
    await pressFromKeyboard(track);
    return track;
  };

  await tickAndTrack();
  await expect.poll(() => posts).toBe(1);
  await ideas.getByRole("button", { name: "Close ideas" }).click();
  await expect(page).not.toHaveURL(/ideas=/);

  const again = await tickAndTrack();
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await expect(again).toBeFocused();
  held.release();
  await expect(again).toHaveCount(0);
  expect(posts).toBe(1);
});

test("a keyword longer than the deep search accepts has no Ideas item", async ({
  page,
  request,
}) => {
  await trackMoreRows(request);
  await routeSpider(page);
  await page.goto(`/apps/${APP}/keywords`);
  await (await hydrated(rowMenu(page))).click();
  await page.getByRole("menuitem", { name: "Ideas" }).click();
  await page
    .getByRole("button", {
      name: `Keyword actions for ${TOO_LONG}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "View search results" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Ideas" })).toHaveCount(0);
});

test("an idle panel does not poll the deep search status", async ({ page }) => {
  let reads = 0;
  await routeSpider(page);
  await page.route(SPIDER_URL, (route) => {
    if (route.request().method() === "GET") reads += 1;
    return route.fallback();
  });
  await page.clock.install();
  await page.goto(`/apps/${APP}/keywords?ideas=${encodeURIComponent(SEED)}`);
  await expect(
    panel(page).getByRole("button", { name: "Find ideas" }),
  ).toBeVisible();
  await page.clock.fastForward(10_000);
  await page.clock.fastForward(10_000);
  expect(reads).toBe(1);
});
