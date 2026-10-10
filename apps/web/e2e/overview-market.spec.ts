import { expect, test } from "./session.mts";

const SWITCHER = "Listing market";
const HOME = "US · United States (home)";
const POLAND = "PL · Poland";
const ALL = "All markets";

test("offers every market together ahead of the single markets", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  const switcher = page.getByRole("combobox", { name: SWITCHER });
  await expect(switcher).toHaveText(HOME);
  await expect(
    page.getByText("Visibility · US", { exact: true }),
  ).toBeVisible();
  await switcher.click();
  await expect(page.getByRole("option")).toHaveText([ALL, HOME, POLAND]);
});

test("asks for the numbers of the selected market", async ({ page }) => {
  await page.goto("/apps/app-1");
  const scoped = page.waitForRequest(/\/apps\/app-1\/summary\?country=pl$/);
  const history = page.waitForRequest(
    /\/apps\/app-1\/visibility-history\?.*country=pl/,
  );

  await page.getByRole("combobox", { name: SWITCHER }).click();
  await page.getByRole("option", { name: POLAND }).click();

  await scoped;
  await history;
  await expect(page).toHaveURL(/market=pl/);
  await expect(
    page.getByText("Visibility · PL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tracked keywords · PL", { exact: true }),
  ).toBeVisible();
});

test("counts every market when all markets is selected", async ({ page }) => {
  await page.goto("/apps/app-1");
  const switcher = page.getByRole("combobox", { name: SWITCHER });

  await switcher.click();
  await page.getByRole("option", { name: ALL }).click();

  await expect(page).toHaveURL(/market=all/);
  await expect(switcher).toHaveText(ALL);
  await expect(
    page.getByText("Visibility · All markets", { exact: true }),
  ).toBeVisible();
});

test("keeps all markets selected across a reload", async ({ page }) => {
  await page.goto("/apps/app-1?market=all");

  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveText(ALL);
  await expect(
    page.getByText("Visibility · All markets", { exact: true }),
  ).toBeVisible();
});

test("names no market on the cards of an app with one market", async ({
  page,
}) => {
  await page.goto("/apps/app-2");

  await expect(page.getByText("Visibility", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveCount(0);
});
