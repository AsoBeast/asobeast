import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { expect, test } from "./session.mts";
import {
  APP_1_COMPETITORS,
  APP_1_DETAIL,
  DELISTED_COOKIE,
} from "./fixtures.mts";

const [RIVAL] = APP_1_COMPETITORS;

const delist = (page: Page, id: string) =>
  page
    .context()
    .addCookies([
      { name: DELISTED_COOKIE, value: id, url: "http://localhost:3000" },
    ]);

const notice = (page: Page) =>
  page.getByRole("note").filter({ hasText: "No longer listed on App Store" });

test("a delisted app names the day the store stopped listing it and the next step", async ({
  page,
}) => {
  await delist(page, APP_1_DETAIL.id);
  await page.goto(`/apps/${APP_1_DETAIL.id}`);

  await expect(notice(page)).toContainText(
    `Since Oct 20, 2026, App Store answers that it has no app ${APP_1_DETAIL.storeAppId} in United States.`,
  );
  await expect(notice(page)).toContainText("delete it from the dashboard.");

  await page.goto(`/apps/${APP_1_DETAIL.id}/keywords`);
  await expect(notice(page)).toBeVisible();
});

test("a refresh that finds the app delisted shows the notice without a reload", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}`);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
  await expect(notice(page)).toHaveCount(0);

  await delist(page, APP_1_DETAIL.id);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();

  await expect(
    page.getByText(`The App Store has no app ${APP_1_DETAIL.storeAppId}.`),
  ).toBeVisible();
  await expect(notice(page)).toBeVisible();
});

test("a listed app shows no delisted notice", async ({ page }) => {
  await delist(page, RIVAL.id);
  await page.goto(`/apps/${APP_1_DETAIL.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: APP_1_DETAIL.name ?? "" }),
  ).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("a delisted competitor carries a delisted badge on the competitors page", async ({
  page,
}) => {
  await delist(page, RIVAL.id);
  await page.goto(`/apps/${APP_1_DETAIL.id}/competitors`);

  const card = page
    .getByRole("button", { name: `Remove ${RIVAL.name}` })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText("Delisted", { exact: true })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("the dashboard marks a delisted app", async ({ page }) => {
  await delist(page, APP_1_DETAIL.id);
  await page.goto("/");

  const card = page
    .getByRole("link", { name: APP_1_DETAIL.name ?? "" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText("Delisted", { exact: true })).toBeVisible();
  await expect(page.getByText("Delisted", { exact: true })).toHaveCount(1);
});

for (const theme of THEMES) {
  test(`the delisted notice and badges have no contrast violation in the ${theme} theme`, async ({
    page,
  }) => {
    await delist(page, APP_1_DETAIL.id);
    expect(
      await contrastViolations(page, theme, `/apps/${APP_1_DETAIL.id}`),
    ).toEqual([]);
    expect(await contrastViolations(page, theme, "/")).toEqual([]);
  });
}
