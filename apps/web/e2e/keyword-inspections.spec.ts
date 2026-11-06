import { expect, test } from "./session.mts";
import { INSPECTED_APPS } from "./keyword-inspections-mock.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API = "http://localhost:4100";

test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK_API}/__reset-keyword-inspections`);
});

test("inspects a keyword and shows its scores and results", async ({
  page,
}) => {
  await page.goto("/inspect");
  await expect(
    page.getByRole("heading", { name: "Keyword inspector", level: 1 }),
  ).toBeVisible();

  await page.getByLabel("Keyword", { exact: true }).fill("Habit Tracker");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();

  await expect(page).toHaveURL(/[?&]id=inspection-1/);
  const results = page.getByRole("table");
  await expect(results.getByText(INSPECTED_APPS[0])).toBeVisible();
  await expect(
    results.getByRole("cell", { name: "Exact phrase" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "habit tracker app" }),
  ).toBeVisible();
  await expect(page.getByText("High confidence")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /habit tracker/ }).first(),
  ).toBeVisible();
});

test("deletes an inspection and returns focus to the keyword box", async ({
  page,
}) => {
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill("water reminder");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);

  await page
    .getByRole("button", { name: "Delete the inspection of water reminder" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Delete the inspection of water reminder",
    }),
  ).toHaveCount(0);
  await expect(page.getByText("No inspection selected")).toBeVisible();
  await expect(page.getByLabel("Keyword", { exact: true })).toBeFocused();
});
