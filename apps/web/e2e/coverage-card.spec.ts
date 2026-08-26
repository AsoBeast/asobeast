import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_1_DETAIL,
  APP_1_SUMMARY,
  APP_GP_DETAIL,
  APP_GP_SUMMARY,
} from "./fixtures.mts";

const coverageCard = (page: Page) =>
  page.locator("[data-slot=card]").filter({ hasText: "Metadata coverage" });

const stat = (card: Locator, label: string) =>
  card.getByText(label, { exact: true }).locator("..");

test("a google play overview reports coverage without a subtitle stat", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}`);
  const card = coverageCard(page);

  await expect(card).toBeVisible();
  await expect(stat(card, "Title")).toContainText(
    String(APP_GP_SUMMARY.coverage.inTitle),
  );
  await expect(stat(card, "Description")).toContainText(
    String(APP_GP_SUMMARY.coverage.inDescription),
  );
  await expect(card.getByText("Subtitle", { exact: true })).toHaveCount(0);
});

test("an app store overview reports coverage for all three fields", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}`);
  const card = coverageCard(page);

  await expect(card).toBeVisible();
  await expect(stat(card, "Title")).toContainText(
    String(APP_1_SUMMARY.coverage.inTitle),
  );
  await expect(stat(card, "Subtitle")).toContainText(
    String(APP_1_SUMMARY.coverage.inSubtitle),
  );
  await expect(stat(card, "Description")).toContainText(
    String(APP_1_SUMMARY.coverage.inDescription),
  );
});
