import type { Locator, Page } from "@playwright/test";
import type {
  SpiderEnqueueResult,
  SpiderStatus,
  TrackedKeywordItem,
} from "@asobeast/shared";
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

const OTHER = "study timer";
const TOO_LONG = "a focus timer phrase that runs well past forty characters";
const KEYWORDS_LIST = new RegExp(`/api/backend/apps/${APP}/keywords(\\?.*)?$`);

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

async function routeRows(page: Page): Promise<void> {
  await page.route(KEYWORDS_LIST, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const rows = (await response.json()) as TrackedKeywordItem[];
    const [first] = rows;
    if (!first) return route.fulfill({ response });
    return route.fulfill({
      response,
      json: [
        ...rows,
        { ...first, keywordId: "kw-ticks-2", text: OTHER },
        { ...first, keywordId: "kw-ticks-3", text: TOO_LONG },
      ],
    });
  });
}

async function routeSpider(
  page: Page,
  started = false,
  posts: unknown[] = [],
): Promise<void> {
  const ran = new Set<string>(started ? [SEED] : []);
  const idle: SpiderStatus = {
    ...STATUS,
    probesDone: 0,
    complete: false,
    suggestions: [],
  };
  await page.route(SPIDER_URL, (route) => {
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
}) => {
  await routeRows(page);
  await routeSpider(page);
  await page.goto(`/apps/${APP}/keywords`);
  await (await hydrated(rowMenu(page))).click();
  await page.getByRole("menuitem", { name: "Ideas" }).click();
  const ideas = panel(page);
  await ideas.getByRole("button", { name: "Find ideas" }).click();
  await expect(ideas.getByRole("listitem").first()).toBeVisible();

  await page
    .getByRole("button", { name: `Keyword actions for ${OTHER}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Ideas" }).click();
  await expect(
    ideas.getByRole("heading", { name: `Ideas for “${OTHER}”` }),
  ).toBeVisible();
  await expect(ideas.getByRole("button", { name: "Find ideas" })).toBeVisible();

  await page.goBack();
  await expect(
    ideas.getByRole("heading", { name: `Ideas for “${SEED}”` }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/ideas=/);
  await expect(
    page.getByRole("button", {
      name: `Keyword actions for ${OTHER}`,
      exact: true,
    }),
  ).toBeFocused();
});

test("a keyword longer than the deep search accepts has no Ideas item", async ({
  page,
}) => {
  await routeRows(page);
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
  await page.goto(`/apps/${APP}/keywords?ideas=${encodeURIComponent(SEED)}`);
  await expect(
    panel(page).getByRole("button", { name: "Find ideas" }),
  ).toBeVisible();
  await page.waitForTimeout(7000);
  expect(reads).toBe(1);
});
