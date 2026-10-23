import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API = "http://localhost:4100";

const removeButton = (page: Page, label: string) =>
  page.getByRole("button", { name: `Remove ${label}` });

const confirmRemoval = (page: Page) =>
  page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove", exact: true })
    .click();

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__reset/app-annotations`);
});

test("hands focus to the surviving row when a removal lands", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await removeButton(page, "Release 5.20.0").click();
  await confirmRemoval(page);

  await expect(removeButton(page, "Release 5.20.0")).toHaveCount(0);
  await expect(removeButton(page, "Autumn campaign")).toBeFocused();
});

test("hands focus to the add form when the list empties", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  for (const label of [
    "Release 5.20.0",
    "Autumn campaign",
    "Keyword field rewrite",
  ]) {
    await removeButton(page, label).click();
    await confirmRemoval(page);
    await expect(removeButton(page, label)).toHaveCount(0);
  }

  await expect(page.getByText("No annotations yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add annotation" }),
  ).toBeFocused();
});
