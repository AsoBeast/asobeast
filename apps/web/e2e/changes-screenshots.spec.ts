import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const timeline = (page: Page) =>
  page
    .getByText("Metadata change timeline")
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const rows = (page: Page, field: string) =>
  timeline(page).locator(`[data-change-field="${field}"]`);

test("labels a replaced screenshot of a competitor and shows both sets", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const row = rows(page, "screenshotImages");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Screenshot images");
  await expect(row).toContainText("Rival Focus");
  await expect(row).toContainText("Screenshot 2 replaced");
  await expect(
    row.getByRole("img", { name: "Before, screenshot 2" }),
  ).toBeVisible();
  await expect(
    row.getByRole("img", { name: "After, screenshot 2" }),
  ).toBeVisible();
  await expect(
    row.getByRole("group", { name: "After screenshots" }),
  ).toHaveAttribute("tabindex", "0");
});

test("shows the captions that appeared and disappeared", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  const row = rows(page, "screenshotCaptions");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Screenshot captions");
  await expect(row.getByText("Removed")).toBeVisible();
  await expect(row).toContainText("Plan your week");
  await expect(row.getByText("Added")).toBeVisible();
  await expect(row).toContainText("Plan your day");
});

test("explains a count change that carries a detail and keeps its numbers", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const row = rows(page, "screenshots").filter({
    hasText: "Screenshot 4 added",
  });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Screenshot 4 added");
  await expect(
    row.getByRole("img", { name: "After, screenshot 4" }),
  ).toBeVisible();
});

test("keeps a count only screenshot event exactly as it was", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const row = rows(page, "screenshots").filter({ hasText: "Rival Focus" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("5");
  await expect(row).toContainText("8");
  await expect(row.getByRole("img", { name: /screenshot/ })).toHaveCount(0);
});
