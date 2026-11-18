import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_TICKS_DETAIL,
  APP_TICKS_LONG_SUGGESTION,
  APP_TICKS_TRACKED_SUGGESTION,
} from "./fixtures.mts";
import { holdRequest, pressFromKeyboard } from "./held-request.mts";
import { chooseKeywordMarket } from "./keyword-controls.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const APP = APP_TICKS_DETAIL.id;
const DISCOVERED = `/apps/${APP}/keywords?tab=discovered`;
const TRACK_REQUEST = new RegExp(`/api/backend/apps/${APP}/keywords$`);

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords/${APP}`, {
    failOnStatusCode: true,
  });
});

const card = (page: Page): Locator =>
  page.locator('[data-slot="card"]').filter({
    has: page.getByRole("heading", { name: "Suggestions", exact: true }),
  });

async function openPanel(page: Page): Promise<Locator> {
  const toggle = page.getByRole("button", {
    name: "Suggestions",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = card(page);
  await expect(panel.getByRole("listitem").first()).toBeVisible();
  return panel;
}

const tick = (panel: Locator, phrase: string): Locator =>
  panel.getByRole("checkbox", { name: phrase });

const trackSelected = (panel: Locator): Locator =>
  panel.getByRole("button", { name: /^Track (\d+ )?selected$/ });

const toast = (page: Page, text: string | RegExp): Locator =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

function trackBodies(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && TRACK_REQUEST.test(request.url())) {
      bodies.push(request.postDataJSON());
    }
  });
  return bodies;
}

test("tracks the ticked suggestions in one request", async ({ page }) => {
  const bodies = trackBodies(page);
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await tick(panel, "study sessions").check();
  await tick(panel, "deep focus").check();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 2 selected");
  await trackSelected(panel).click();

  await expect(
    toast(page, "Tracking 2 keywords. Positions arrive within minutes."),
  ).toBeVisible();
  expect(bodies).toEqual([
    { keywords: ["deep focus", "study sessions"], country: "us" },
  ]);
  for (const phrase of ["deep focus", "study sessions"]) {
    await expect(
      panel.getByRole("button", { name: `Tracked: ${phrase}` }),
    ).toBeVisible();
    await expect(tick(panel, phrase)).toHaveCount(0);
  }
  await expect(trackSelected(panel)).toHaveAccessibleName("Track selected");
  await expect(trackSelected(panel)).toHaveAttribute("aria-disabled", "true");
});

test("keeps the one click Track beside the ticks", async ({ page }) => {
  const bodies = trackBodies(page);
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await tick(panel, "deep focus").check();
  await panel.getByRole("button", { name: "Track pomodoro timer" }).click();

  await expect(toast(page, "Tracking pomodoro timer")).toBeVisible();
  expect(bodies).toEqual([{ keywords: ["pomodoro timer"], country: "us" }]);
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 1 selected");
  await expect(tick(panel, "deep focus")).toBeChecked();
});

test("keeps the ticks after a refusal and tracks them on retry", async ({
  page,
  context,
}) => {
  const bodies = trackBodies(page);
  await context.addCookies([
    { name: "e2e_keyword_quota", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await tick(panel, "deep focus").check();
  await tick(panel, "pomodoro timer").check();
  await trackSelected(panel).click();

  await expect(toast(page, /^Keyword markets limit reached/)).toBeVisible();
  await expect(tick(panel, "deep focus")).toBeChecked();
  await expect(tick(panel, "pomodoro timer")).toBeChecked();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 2 selected");

  await context.clearCookies({ name: "e2e_keyword_quota" });
  await trackSelected(panel).click();

  await expect(
    toast(page, "Tracking 2 keywords. Positions arrive within minutes."),
  ).toBeVisible();
  expect(bodies).toEqual([
    { keywords: ["deep focus", "pomodoro timer"], country: "us" },
    { keywords: ["deep focus", "pomodoro timer"], country: "us" },
  ]);
  await expect(trackSelected(panel)).toHaveAccessibleName("Track selected");
});

test("clears the ticks on a source change", async ({ page }) => {
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await tick(panel, "deep focus").check();
  await panel.getByRole("tab", { name: "Reviews" }).click();
  await expect(tick(panel, "calm timer")).not.toBeChecked();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track selected");
  await panel.getByRole("tab", { name: "Metadata" }).click();

  await expect(tick(panel, "deep focus")).not.toBeChecked();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track selected");
});

test("clears the ticks on a market change", async ({ page }) => {
  const bodies = trackBodies(page);
  await page.goto(DISCOVERED);
  let panel = await openPanel(page);

  await tick(panel, "deep focus").check();
  await chooseKeywordMarket(page, /^United Kingdom/);
  await expect(page).toHaveURL(/country=gb/);
  panel = await openPanel(page);
  await expect(tick(panel, "deep focus")).not.toBeChecked();
  await chooseKeywordMarket(page, /^United States/);
  await expect(page).not.toHaveURL(/country=gb/);
  panel = await openPanel(page);

  await expect(tick(panel, "deep focus")).not.toBeChecked();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track selected");
  expect(bodies).toEqual([]);
});

test("a tracked suggestion has no tick", async ({ page }) => {
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await expect(tick(panel, APP_TICKS_TRACKED_SUGGESTION)).toHaveCount(0);
  await expect(
    panel.getByRole("button", {
      name: `Tracked: ${APP_TICKS_TRACKED_SUGGESTION}`,
    }),
  ).toBeVisible();
});

test("drops a tick when its phrase is tracked on its own", async ({ page }) => {
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);

  await tick(panel, "deep focus").check();
  await tick(panel, "work sprints").check();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 2 selected");
  await panel.getByRole("button", { name: "Track deep focus" }).click();

  await expect(toast(page, "Tracking deep focus")).toBeVisible();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 1 selected");
  await expect(tick(panel, "deep focus")).toHaveCount(0);
});

test("keeps the bulk button inside the card on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);
  await tick(panel, "deep focus").check();

  const cardBox = await panel.boundingBox();
  const buttonBox = await trackSelected(panel).boundingBox();
  expect(cardBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("truncates a long suggestion and keeps its controls on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);
  const cardBox = await panel.boundingBox();
  const tickBox = await tick(panel, APP_TICKS_LONG_SUGGESTION).boundingBox();
  const textBox = await panel
    .getByText(APP_TICKS_LONG_SUGGESTION, { exact: true })
    .boundingBox();
  const trackBox = await panel
    .getByRole("button", { name: `Track ${APP_TICKS_LONG_SUGGESTION}` })
    .boundingBox();

  expect(cardBox).not.toBeNull();
  expect(tickBox).not.toBeNull();
  expect(trackBox).not.toBeNull();
  expect(tickBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(textBox!.x + textBox!.width).toBeLessThanOrEqual(trackBox!.x);
  expect(trackBox!.x + trackBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );
});

test("hands focus to the row's button when tracking removes a focused tick", async ({
  page,
}) => {
  const held = await holdRequest(page, TRACK_REQUEST, "POST");
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);
  await tick(panel, "deep focus").check();

  await pressFromKeyboard(trackSelected(panel));
  await tick(panel, "deep focus").focus();
  held.release();

  const tracked = panel.getByRole("button", { name: "Tracked: deep focus" });
  await expect(tracked).toBeVisible();
  await expect(tick(panel, "deep focus")).toHaveCount(0);
  await expect(tracked).toBeFocused();
});

test("leaves a phrase its own Track is sending out of the bulk request", async ({
  page,
}) => {
  const bodies = trackBodies(page);
  const held = await holdRequest(page, TRACK_REQUEST, "POST");
  await page.goto(DISCOVERED);
  const panel = await openPanel(page);
  await tick(panel, "deep focus").check();
  await tick(panel, "study sessions").check();

  await panel.getByRole("button", { name: "Track deep focus" }).click();
  await expect(trackSelected(panel)).toHaveAccessibleName("Track 1 selected");
  await trackSelected(panel).click();
  await expect(
    panel.getByRole("button", { name: "Track study sessions" }),
  ).toHaveAttribute("aria-busy", "true");
  held.release();

  await expect(
    toast(page, "Tracking 1 keyword. Positions arrive within minutes."),
  ).toBeVisible();
  expect(bodies).toEqual([
    { keywords: ["deep focus"], country: "us" },
    { keywords: ["study sessions"], country: "us" },
  ]);
});
