import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  errorEnvelope,
  APP_1_PL_DETAIL,
  APP_1_PL_LOCALIZED_SCREENSHOTS,
  APP_1_PL_SCREENSHOTS,
  APP_GP_SCREENSHOTS,
  APP_RIVAL_ID,
} from "./fixtures.mts";
import { THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";

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

const cutNotes = (page: Page) =>
  previewCard(page).locator('[data-slot="store-preview-cuts"]');

test("marks a long title as cut and says where", async ({ page }) => {
  await page.goto("/apps/app-long");

  const title = frame(page).locator('[data-slot="store-text"]').first();
  await expect(title).toHaveAttribute("data-cut", "true");
  await expect(title).toContainText("…");
  await expect(cutNotes(page).locator("p").first()).toContainText(
    /^Cut after “.+” on (smaller|every) iPhones?\. Words after the cut still count for search\.$/,
  );
  await expect(
    previewCard(page).getByRole("button", { name: "About the estimate" }),
  ).toBeVisible();
});

test("shows no sentence for a short title", async ({ page }) => {
  await page.goto("/apps/app-1");

  await expect(
    frame(page).locator('[data-slot="store-text"]').first(),
  ).not.toHaveAttribute("data-cut", "true");
  await expect(frame(page)).toBeVisible();
  await expect(cutNotes(page)).toHaveCount(0);
});

test("switches to the 6.7 inch frame", async ({ page }) => {
  await page.goto("/apps/app-long");
  await expect(cutNotes(page)).toBeVisible();

  await previewCard(page).getByRole("tab", { name: "6.7 inch" }).click();

  await expect(frame(page)).toHaveAttribute("data-device", "large");
  await expect(frame(page)).toHaveAttribute("style", /width: 430px/);
  await expect(cutNotes(page).locator("p").first()).toContainText(
    /on (larger|every) iPhones?\./,
  );
});

test("names the phone sizes on Google Play", async ({ page }) => {
  await page.goto("/apps/app-gp");

  await expect(
    previewCard(page).getByRole("tab", { name: "Smaller phone" }),
  ).toHaveAttribute("aria-selected", "true");
  await previewCard(page).getByRole("tab", { name: "Larger phone" }).click();
  await expect(frame(page)).toHaveAttribute("style", /width: 412px/);
});

const draftEditor = (page: Page) =>
  page.getByRole("region", { name: "Draft listing" });
const draftField = (page: Page, name: string) =>
  draftEditor(page).getByRole("textbox", { name, exact: true });

test("follows the draft while typing", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(draftField(page, "Title"));

  await title.fill("Focus Timer: Pomodoro Study Planner");
  await expect(
    frame(page).locator('[data-slot="store-text"]').first(),
  ).toContainText("…");
  await expect(cutNotes(page).locator("p").first()).toContainText(
    /^Cut after “/,
  );
  await expect(previewCard(page)).toContainText("Your draft");

  await title.fill("Focus");
  await expect(
    previewCard(page).getByRole("img", {
      name: "App Store search result: Focus",
    }),
  ).toBeVisible();
  await expect(cutNotes(page)).toHaveCount(0);
});

test("shows the drafted promotional text on the product page", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const promotional = await hydrated(draftField(page, "Promotional text"));
  await expect(
    draftEditor(page).getByText("Not searched by the store").first(),
  ).toBeVisible();

  await promotional.fill("New: focus streaks with friends");
  await chooseSurface(page, "Product page");

  await expect(frame(page)).toContainText("New: focus streaks with friends");
});

test("previews the screenshots of the drafted localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl&mode=draft");

  await expect(screenshotsIn(page)).toHaveCount(
    APP_1_PL_LOCALIZED_SCREENSHOTS.screenshots.length,
  );
});

test("says so when the screenshots cannot be read", async ({ page }) => {
  await page.route(/\/apps\/app-gp\/screenshots/, (route) =>
    route.fulfill(
      fulfillJson(404, errorEnvelope(404, "/apps/app-gp/screenshots")),
    ),
  );
  await page.goto("/apps/app-gp/metadata?mode=draft");

  await expect(
    previewCard(page).getByText(
      "Could not read the screenshots of this listing.",
    ),
  ).toBeVisible();
  await expect(frame(page)).toBeVisible();
  await expect(frame(page)).not.toContainText("No screenshots captured yet");
});
