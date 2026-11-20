import type { Page } from "@playwright/test";
import {
  APP_FEW_RATINGS_ID,
  APP_RIVAL_ID,
  APP_UNRATED_ID,
} from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const ASSUMPTION =
  "Assumes every new rating is five stars and that the store shows one decimal.";
const PLAY_NOTE =
  "Google Play gives recent ratings more weight, so read this as a rough guide.";
const THIN_NOTE =
  "With fewer than 20 ratings the average moves a lot with each new one.";

const goalCard = (page: Page) =>
  page.getByRole("region", { name: "Ratings goal" });

async function openGoal(page: Page, appId: string) {
  await page.goto(`/apps/${appId}/reviews`);
  const card = goalCard(page);
  await expect(card).toBeVisible();
  return {
    card,
    target: await hydrated(card.getByLabel("Target rating")),
    days: card.getByLabel("Days"),
  };
}

test("the goal starts one tenth above the shown average and names the pace", async ({
  page,
}) => {
  const { card, target, days } = await openGoal(page, "app-1");

  await expect(target).toHaveValue("4.9");
  await expect(days).toHaveValue("30");
  await expect(
    card.getByText(
      "To show 4.9 you need 8,000 more five-star ratings, about 267 a day for 30 days.",
    ),
  ).toBeVisible();
  await expect(card.getByText(ASSUMPTION)).toBeVisible();
  await expect(card.getByText(PLAY_NOTE)).toHaveCount(0);
  await expect(card.getByText(THIN_NOTE)).toHaveCount(0);

  await days.fill("365");
  await expect(
    card.getByText(
      "To show 4.9 you need 8,000 more five-star ratings, about 22 a day for 365 days.",
    ),
  ).toBeVisible();
});

test("a target the store already shows says so without a count", async ({
  page,
}) => {
  const { card, target } = await openGoal(page, "app-1");

  await target.fill("4.8");
  await expect(card.getByText("The store already shows 4.8.")).toBeVisible();

  await target.fill("4.5");
  await expect(
    card.getByText("The store already shows 4.8, above 4.5."),
  ).toBeVisible();
});

test("an invalid field names its range in the live region and is linked to it", async ({
  page,
}) => {
  const { card, target, days } = await openGoal(page, "app-1");
  const live = card.locator("[aria-live='polite']");

  await target.fill("4.55");
  await expect(target).toHaveAttribute("aria-invalid", "true");
  await expect(target).toHaveAccessibleDescription(
    "Enter a target from 0.1 to 5.0 with at most one decimal.",
  );
  await expect(live).toHaveText(
    "Enter a target from 0.1 to 5.0 with at most one decimal.",
  );

  await target.fill("4.9");
  await days.fill("0");
  await expect(target).not.toHaveAttribute("aria-invalid");
  await expect(days).toHaveAttribute("aria-invalid", "true");
  await expect(days).toHaveAccessibleDescription(
    "Enter a whole number of days from 1 to 365.",
  );
  await expect(live).toHaveText("Enter a whole number of days from 1 to 365.");

  await days.fill("30");
  await expect(days).not.toHaveAttribute("aria-invalid");
  await expect(live).toHaveText(
    "To show 4.9 you need 8,000 more five-star ratings, about 267 a day for 30 days.",
  );
});

test("a small app hears a thin sample note and a pace spread over the days", async ({
  page,
}) => {
  const { card, target } = await openGoal(page, APP_FEW_RATINGS_ID);

  await expect(target).toHaveValue("4.4");
  await expect(
    card.getByText("To show 4.4 you need 1 more five-star rating."),
  ).toBeVisible();
  await expect(card.getByText(THIN_NOTE)).toBeVisible();

  await target.fill("4.6");
  await expect(
    card.getByText(
      "To show 4.6 you need 6 more five-star ratings, about one every 5 days for 30 days.",
    ),
  ).toBeVisible();
});

test("an app with no ratings yet needs only its first five-star rating", async ({
  page,
}) => {
  const { card, target } = await openGoal(page, APP_UNRATED_ID);

  await expect(target).toHaveValue("5.0");
  await expect(
    card.getByText(
      "With no ratings yet, the first five-star rating shows 5.0.",
    ),
  ).toBeVisible();
});

test("a Google Play app reads the goal as a rough guide", async ({ page }) => {
  const { card } = await openGoal(page, "app-gp");

  await expect(card.getByText(PLAY_NOTE)).toBeVisible();
});

test("a competitor and an app without a stored rating draw no goal", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_RIVAL_ID}/reviews`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(goalCard(page)).toHaveCount(0);

  await page.goto("/apps/app-new/reviews");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(goalCard(page)).toHaveCount(0);
});

test("the goal card fits a 375 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { card } = await openGoal(page, "app-1");

  expect(
    await card.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
