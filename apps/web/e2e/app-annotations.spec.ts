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

test("removes an added annotation by its own id", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await removeButton(page, "Release 5.20.0").click();
  await confirmRemoval(page);
  await expect(removeButton(page, "Release 5.20.0")).toHaveCount(0);

  const dateBox = page.getByLabel("Date", { exact: true });
  const labelBox = page.getByLabel("Label", { exact: true });
  const add = page.getByRole("button", { name: "Add annotation" });

  await expect(async () => {
    await dateBox.fill("2030-02-01");
    await labelBox.fill("Fresh marker");
    await expect(dateBox).toHaveValue("2030-02-01");
    await expect(labelBox).toHaveValue("Fresh marker");
  }).toPass();
  await expect(add).toBeEnabled();
  await add.click();

  const added = removeButton(page, "Fresh marker");
  await expect(added).toBeVisible();

  await added.click();
  await confirmRemoval(page);
  await expect(removeButton(page, "Fresh marker")).toHaveCount(0);
  await expect(removeButton(page, "Keyword field rewrite")).toBeVisible();
});
