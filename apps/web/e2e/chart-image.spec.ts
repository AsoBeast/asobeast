import type { Page } from "@playwright/test";
import {
  clipboardPng,
  isPng,
  readPng,
  withoutImageClipboard,
  withRefusedClipboard,
} from "./chart-image.mts";
import { utcDaysAgo } from "./fixtures.mts";
import { holdRequest } from "./held-request.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/rankings";
const RANKINGS = /\/api\/backend\/apps\/app-1\/rankings\?/;
const FILENAME = new RegExp(
  `^asobeast-rankings-focus-timer-${utcDaysAgo(7)}-${utcDaysAgo(0)}\\.png$`,
);

const chart = (page: Page) =>
  page.getByRole("region", { name: "Keyword rank positions" });
const copy = (page: Page) =>
  page.getByRole("button", {
    name: "Copy image of the rankings chart",
    exact: true,
  });
const download = (page: Page) =>
  page.getByRole("button", {
    name: "Download PNG of the rankings chart",
    exact: true,
  });

test.beforeEach(({ context }) =>
  context.grantPermissions(["clipboard-read", "clipboard-write"]),
);

test("the image buttons are named from their visible words", async ({
  page,
}) => {
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  await expect(copy(page)).toHaveCount(1);
  await expect(download(page)).toHaveCount(1);
  for (const button of await page
    .locator("button", { hasText: /Copy image|Download PNG/ })
    .all()) {
    await expect(button).not.toHaveAttribute("aria-label", /.+/);
  }
});

test("Copy image puts a png of the chart on the clipboard", async ({
  page,
}) => {
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  await copy(page).click();
  await expect(page.getByText("Chart copied")).toBeVisible();

  const png = await clipboardPng(page);
  expect(isPng(png)).toBe(true);
  const reading = await readPng(page, png, "--chart-1");
  expect(reading.width).toBeGreaterThan(1000);
  expect(reading.height).toBeGreaterThan(reading.width / 3);
  expect(reading.corner).toEqual(reading.background);
  expect(reading.seriesPixels).toBeGreaterThan(400);
});

test("Download PNG saves the same picture under a readable name", async ({
  page,
}) => {
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    download(page).click(),
  ]);

  expect(file.suggestedFilename()).toMatch(FILENAME);
  const path = await file.path();
  expect(path).not.toBeNull();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path ?? "");
  expect(isPng(bytes)).toBe(true);
  expect(
    (await readPng(page, bytes, "--chart-1")).seriesPixels,
  ).toBeGreaterThan(400);
});

test("the picture follows the dark theme the page is in", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  await copy(page).click();
  await expect(page.getByText("Chart copied")).toBeVisible();

  const reading = await readPng(page, await clipboardPng(page), "--chart-1");
  expect(reading.corner).toEqual(reading.background);
  expect(reading.background[0]).toBeLessThan(80);
  expect(reading.seriesPixels).toBeGreaterThan(400);
});

test("a browser without an image clipboard downloads instead", async ({
  page,
}) => {
  await withoutImageClipboard(page);
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    copy(page).click(),
  ]);

  expect(file.suggestedFilename()).toMatch(FILENAME);
  await expect(
    page.getByText("Clipboard unavailable, downloaded instead"),
  ).toBeVisible();
});

test("a refused clipboard write downloads instead", async ({ page }) => {
  await withRefusedClipboard(page);
  await page.goto(PAGE);
  await expect(chart(page)).toBeVisible();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    copy(page).click(),
  ]);

  expect(file.suggestedFilename()).toMatch(FILENAME);
  await expect(
    page.getByText("Clipboard unavailable, downloaded instead"),
  ).toBeVisible();
});

test("a click while the lines are still drawing in captures the whole line", async ({
  page,
}) => {
  await page.goto(PAGE);
  await copy(page).click();
  await expect(page.getByText("Chart copied")).toBeVisible();

  const reading = await readPng(page, await clipboardPng(page), "--chart-1");
  expect(reading.seriesPixels).toBeGreaterThan(400);
});

test.describe("states without a trend offer no image", () => {
  const buttons = (page: Page) =>
    page.getByRole("button", { name: /^(Copy image|Download PNG)/ });

  const narrowTo7Days = async (page: Page) => {
    await page.goto(PAGE);
    await expect(chart(page)).toBeVisible();
    await expect(buttons(page)).toHaveCount(2);
  };

  const pickSevenDays = () => (page: Page) =>
    page
      .getByRole("tablist", { name: "Date range" })
      .getByRole("tab", { name: "7d" })
      .click();

  test("while the history loads", async ({ page }) => {
    await narrowTo7Days(page);
    const held = await holdRequest(page, RANKINGS, "GET");

    await pickSevenDays()(page);

    await expect(chart(page)).toBeHidden();
    await expect(buttons(page)).toHaveCount(0);
    held.release();
    await expect(chart(page)).toBeVisible();
    await expect(buttons(page)).toHaveCount(2);
  });

  test("with fewer than four checks", async ({ page }) => {
    await narrowTo7Days(page);
    await page.route(RANKINGS, (route) =>
      route.fulfill({
        json: {
          series: [
            {
              keywordId: "kw-1",
              text: "focus timer",
              store: "APP_STORE",
              country: "us",
              points: [
                { date: utcDaysAgo(1), position: 4, depth: 200 },
                { date: utcDaysAgo(0), position: 3, depth: 200 },
              ],
            },
          ],
        },
      }),
    );

    await pickSevenDays()(page);

    await expect(
      page.getByText("Not enough history for a trend"),
    ).toBeVisible();
    await expect(buttons(page)).toHaveCount(0);
  });

  test("with no checks in the range", async ({ page }) => {
    await narrowTo7Days(page);
    await page.route(RANKINGS, (route) =>
      route.fulfill({ json: { series: [] } }),
    );

    await pickSevenDays()(page);

    await expect(
      page.getByText("Nothing captured in this range"),
    ).toBeVisible();
    await expect(buttons(page)).toHaveCount(0);
  });
});
