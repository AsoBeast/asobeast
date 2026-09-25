import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_COMBOS_DETAIL,
  APP_COMBOS_KEYWORD_FIELD,
  APP_GP_DETAIL,
} from "./fixtures.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const COMBOS_PAGE = `/apps/${APP_COMBOS_DETAIL.id}/keywords`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords`, {
    failOnStatusCode: true,
  });
  await request.put(
    `${MOCK_API_URL}/apps/${APP_COMBOS_DETAIL.id}/keyword-field`,
    { data: { text: APP_COMBOS_KEYWORD_FIELD }, failOnStatusCode: true },
  );
});

const combinations = (page: Page) =>
  page.getByRole("region", { name: "Keyword combinations" });

const phrases = (card: Locator) => card.getByRole("rowheader");

const rowOf = (card: Locator, phrase: string) =>
  card.getByRole("row").filter({
    has: card.page().getByRole("rowheader", { name: phrase, exact: true }),
  });

test("the combinations card opens on demand and lists the listing's phrases", async ({
  page,
}) => {
  await page.goto(COMBOS_PAGE);
  const toggle = page.getByRole("button", { name: "Keyword combinations" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(combinations(page)).toHaveCount(0);

  await toggle.click();

  await expect(page).toHaveURL(/combos=true/);
  const card = combinations(page);
  await expect(card.getByText("231 of 231 combinations")).toBeVisible();
  await expect(phrases(card)).toHaveCount(50);
  await expect(phrases(card).nth(0)).toHaveText("mood");
  await expect(phrases(card).nth(11)).toHaveText("mood journal");
});

test("each phrase names its status and where its words come from", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?combos=true&comboStatus=tracked`);
  const card = combinations(page);
  await expect(phrases(card)).toHaveText([
    "water",
    "mood journal",
    "mood tracker",
    "daily diary",
    "daily planner",
    "sleep notes",
  ]);
  await expect(rowOf(card, "daily diary")).toContainText("as diary daily");
  await expect(rowOf(card, "sleep notes")).toContainText("as sleep notes app");
  await expect(rowOf(card, "mood tracker")).toContainText(
    "Title, Keyword field",
  );

  await page.goto(`${COMBOS_PAGE}?combos=true&comboStatus=paused`);
  await expect(phrases(card)).toHaveText(["gratitude"]);
  await expect(rowOf(card, "gratitude")).toContainText("Paused");

  await page.goto(`${COMBOS_PAGE}?combos=true&comboQ=evening`);
  await expect(
    card.getByText("No combinations match these filters"),
  ).toBeVisible();
  await card.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/comboQ=/);
  await expect(card.getByText("231 of 231 combinations")).toBeVisible();
});

test("search and facets live under their own address keys", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?combos=true`);
  const card = combinations(page);

  await card
    .getByRole("textbox", { name: "Search combinations" })
    .fill("journal");

  await expect(page).toHaveURL(/comboQ=journal/);
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(card.getByText("56 of 231 combinations")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search keywords" }),
  ).toHaveValue("");

  await card.getByRole("button", { name: "Filter by words" }).click();
  await page.getByRole("option", { name: /3 words/ }).click();
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/comboWords=3/);
  await expect(card.getByText("45 of 231 combinations")).toBeVisible();
  await expect(card.getByText("Search: journal")).toBeVisible();
  await expect(card.getByText("Words: 3")).toBeVisible();

  await card.getByRole("button", { name: "Clear all" }).click();

  await expect(page).not.toHaveURL(/comboQ=|comboWords=/);
  await expect(card.getByText("231 of 231 combinations")).toBeVisible();
});

test("rows arrive fifty at a time and a new filter starts over", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?combos=true`);
  const card = combinations(page);
  await expect(phrases(card)).toHaveCount(50);
  await expect(card.getByText("Showing 50 of 231")).toBeVisible();

  await card.getByRole("button", { name: "Show 50 more" }).click();

  await expect(phrases(card)).toHaveCount(100);
  await expect(card.getByText("Showing 100 of 231")).toBeVisible();

  await card.getByRole("textbox", { name: "Search combinations" }).fill("mood");

  await expect(card.getByText("Showing 50 of 56")).toBeVisible();
  await expect(phrases(card)).toHaveCount(50);
});

test("another market points back to the home market listing", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?country=gb&combos=true`);
  const card = combinations(page);
  await expect(
    card.getByText(
      "Combinations come from the listing in your home market, United States.",
    ),
  ).toBeVisible();
  await expect(phrases(card)).toHaveCount(0);

  await card.getByRole("button", { name: "Switch to United States" }).click();

  await expect(page).not.toHaveURL(/country=/);
  await expect(card.getByText("231 of 231 combinations")).toBeVisible();
});

test("a google play listing combines its title and short description", async ({
  page,
}) => {
  const fieldRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/keyword-field")) {
      fieldRequests.push(request.url());
    }
  });

  await page.goto(
    `/apps/${APP_GP_DETAIL.id}/keywords?combos=true&comboStatus=tracked`,
  );
  const card = combinations(page);

  await expect(card.getByText("3 of 298 combinations")).toBeVisible();
  await expect(phrases(card)).toHaveText([
    "fokus",
    "timer pomodoro",
    "timer lernphasen",
  ]);
  await expect(rowOf(card, "timer pomodoro")).toContainText(
    "as pomodoro timer",
  );
  await expect(rowOf(card, "fokus")).toContainText("Short description");
  await expect(page.getByText(/title and short description/)).toBeVisible();
  expect(fieldRequests).toEqual([]);
});

const trackRequest = (page: Page) =>
  page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(`/apps/${APP_COMBOS_DETAIL.id}/keywords`),
  );

test("selected combinations are tracked after one confirmation", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?combos=true`);
  const card = combinations(page);

  await expect(
    card.getByRole("checkbox", { name: "water: already tracked" }),
  ).toBeDisabled();
  for (const phrase of ["journal", "diary", "gratitude"]) {
    await card
      .getByRole("checkbox", { name: `Select ${phrase}`, exact: true })
      .check();
  }
  await card.getByRole("button", { name: "Track selected (3)" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Track 3 keywords in United States?",
  });
  await expect(dialog).toContainText("one store search a day");
  await expect(
    dialog.getByRole("link", { name: "Review the daily request budget" }),
  ).toHaveAttribute("href", "/settings#daily-capacity");
  let sent = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/keywords")) {
      sent += 1;
    }
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(sent).toBe(0);

  await card.getByRole("button", { name: "Track selected (3)" }).click();
  const request = trackRequest(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Track", exact: true })
    .click();

  expect((await request).postDataJSON()).toEqual({
    keywords: ["journal", "diary", "gratitude"],
    country: "us",
  });
  await expect(page.getByText("Tracking 3 keywords")).toBeVisible();
  await expect(rowOf(card, "journal")).toContainText("Tracked");
  await expect(
    card.getByRole("button", { name: "Track selected (0)" }),
  ).toBeDisabled();
});

test("every combination the filters show is tracked at once", async ({
  page,
}) => {
  await page.goto(`${COMBOS_PAGE}?combos=true&comboWords=1`);
  const card = combinations(page);
  await expect(page.getByText("Tracking 7 keywords · 6 active")).toBeVisible();

  await card.getByRole("button", { name: "Track all shown (10)" }).click();
  const request = trackRequest(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Track", exact: true })
    .click();

  expect((await request).postDataJSON()).toEqual({
    keywords: [
      "mood",
      "journal",
      "daily",
      "diary",
      "gratitude",
      "log",
      "sleep",
      "notes",
      "tracker",
      "planner",
    ],
    country: "us",
  });
  await expect(page.getByText("Tracking 10 keywords")).toBeVisible();
  await expect(rowOf(card, "gratitude")).toContainText("Tracked");
  await expect(
    card.getByRole("button", { name: "Track all shown (0)" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Tracking 16 keywords · 16 active"),
  ).toBeVisible();
});

test("a quota error stops the run and names what was tracked", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "e2e_keyword_quota",
      value: "210",
      domain: "localhost",
      path: "/",
    },
  ]);
  const sizes: number[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/apps/${APP_COMBOS_DETAIL.id}/keywords`)
    ) {
      sizes.push(
        (request.postDataJSON() as { keywords: string[] }).keywords.length,
      );
    }
  });
  await page.goto(`${COMBOS_PAGE}?combos=true&comboStatus=untracked`);
  const card = combinations(page);

  await card.getByRole("button", { name: "Track all shown (224)" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Track", exact: true })
    .click();

  await expect(
    page.getByText(
      "keywordMarkets limit reached: 206 of 210 used on the indie plan, 24 more requested",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("200 of 224 tracked before this error"),
  ).toBeVisible();
  await expect(card.getByText("24 of 231 combinations")).toBeVisible();
  expect(sizes).toEqual([200, 24]);
});
