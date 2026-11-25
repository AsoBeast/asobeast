import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_1_PL_DETAIL,
  APP_1_PL_SCREENSHOTS,
  APP_GP_SCREENSHOTS,
  APP_RIVAL_ID,
} from "./fixtures.mts";
import { THEMES } from "./contrast-check.mts";

const previewCard = (page: Page) =>
  page.getByRole("region", { name: "In the store" });

const frame = (page: Page) =>
  previewCard(page).locator('[data-slot="store-preview-frame"]');

const screenshotsIn = (page: Page) =>
  frame(page).locator('[data-slot="store-preview-screenshots"] > *');

const chooseSurface = (page: Page, name: string) =>
  previewCard(page).getByRole("tab", { name }).click();

test("draws the search result with icon, title, subtitle, rating and three screenshots", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  await expect(
    previewCard(page).getByRole("img", {
      name: "App Store search result: Focus Timer",
    }),
  ).toBeVisible();
  await expect(frame(page)).toContainText("Pomodoro & deep work");
  await expect(frame(page)).toContainText("4.8");
  await expect(frame(page)).toContainText("24K");
  await expect(screenshotsIn(page)).toHaveCount(3);
  await expect(previewCard(page)).toContainText("The newest captured listing");
});

test("switches to the product page", async ({ page }) => {
  await page.goto("/apps/app-1");
  await chooseSurface(page, "Product page");

  await expect(
    previewCard(page).getByRole("img", {
      name: "App Store product page: Focus Timer",
    }),
  ).toBeVisible();
  await expect(frame(page)).toContainText("Pomodoro & deep work");
  await expect(screenshotsIn(page)).toHaveCount(3);
  await expect(
    previewCard(page).getByRole("tab", { name: "Product page" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("draws the Play search card and product page", async ({ page }) => {
  await page.goto("/apps/app-gp");

  await expect(
    previewCard(page).getByRole("img", {
      name: "Google Play search result: Tomato Clock",
    }),
  ).toBeVisible();
  await expect(frame(page)).toContainText("4.4");
  await expect(frame(page)).not.toContainText("Get");

  await chooseSurface(page, "Product page");
  await expect(
    previewCard(page).getByRole("img", {
      name: "Google Play product page: Tomato Clock",
    }),
  ).toBeVisible();
  await expect(frame(page)).toContainText("Fokus Timer für Pomodoro");
  await expect(screenshotsIn(page)).toHaveCount(
    APP_GP_SCREENSHOTS.screenshots.length,
  );
});

test("draws an app with no screenshots without empty frames", async ({
  page,
}) => {
  await page.goto("/apps/app-2");

  await expect(frame(page)).toContainText("No screenshots captured yet");
  await expect(
    frame(page).locator('[data-slot="store-preview-screenshots"]'),
  ).toHaveCount(0);
});

for (const theme of THEMES) {
  test(`draws in the ${theme} theme`, async ({ page }, testInfo) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/apps/app-1");

    await expect(page.locator("html")).toHaveClass(
      theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/,
    );
    for (const surface of ["Search result", "Product page"]) {
      await chooseSurface(page, surface);
      await expect(frame(page)).toBeVisible();
      await testInfo.attach(`${theme} ${surface}`, {
        body: await previewCard(page).screenshot(),
        contentType: "image/png",
      });
    }
  });
}

test("previews the market on screen", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");

  await expect(
    previewCard(page).getByRole("img", {
      name: `App Store search result: ${APP_1_PL_DETAIL.latestSnapshot?.title}`,
    }),
  ).toBeVisible();
  await expect(screenshotsIn(page)).toHaveCount(
    APP_1_PL_SCREENSHOTS.screenshots.length,
  );
});

test("folds and stays folded", async ({ page }) => {
  await page.goto("/apps/app-1");
  await expect(frame(page)).toBeVisible();

  await previewCard(page).getByRole("button", { name: "In the store" }).click();
  await expect(frame(page)).toHaveCount(0);

  const screenshotReads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/screenshots")) {
      screenshotReads.push(request.url());
    }
  });
  await page.reload();
  await expect(
    previewCard(page).getByRole("button", { name: "In the store" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.waitForLoadState("networkidle");
  await expect(frame(page)).toHaveCount(0);
  expect(screenshotReads).toEqual([]);
});

test("is left out for a competitor", async ({ page }) => {
  await page.goto(`/apps/${APP_RIVAL_ID}`);

  await expect(
    page.getByRole("heading", { name: "Metadata coverage" }),
  ).toBeVisible();
  await expect(previewCard(page)).toHaveCount(0);
});
