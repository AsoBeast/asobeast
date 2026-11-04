import { readFileSync } from "node:fs";
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

test.describe("the opportunity map image", () => {
  const MAP = "/apps/app-map/keywords?view=map";
  const mapRegion = (page: Page) =>
    page.getByRole("region", { name: "Keyword opportunity map" });
  const copyMap = (page: Page) =>
    page.getByRole("button", {
      name: "Copy image of the opportunity map",
      exact: true,
    });
  const downloadMap = (page: Page) =>
    page.getByRole("button", {
      name: "Download PNG of the opportunity map",
      exact: true,
    });

  test("the buttons are named from their visible words", async ({ page }) => {
    await page.goto(MAP);
    await expect(mapRegion(page)).toBeVisible();
    await expect(copyMap(page)).toHaveCount(1);
    await expect(downloadMap(page)).toHaveCount(1);
    await expect(copyMap(page)).not.toHaveAttribute("aria-label", /.+/);
    await expect(downloadMap(page)).not.toHaveAttribute("aria-label", /.+/);
  });

  test("Download PNG saves a readable name", async ({ page }) => {
    await page.goto(MAP);
    await expect(mapRegion(page)).toBeVisible();
    const today = utcDaysAgo(0);

    const [file] = await Promise.all([
      page.waitForEvent("download"),
      downloadMap(page).click(),
    ]);

    expect(file.suggestedFilename()).toBe(
      `asobeast-opportunity-map-opportunity-map-lab-${today}-${today}.png`,
    );
    const path = await file.path();
    expect(isPng(readFileSync(path))).toBe(true);
  });

  const copiedReading = async (page: Page, url: string) => {
    await page.goto(url);
    await expect(mapRegion(page)).toBeVisible();
    await copyMap(page).click();
    await expect(page.getByText("Chart copied")).toBeVisible();
    const png = await clipboardPng(page);
    expect(isPng(png)).toBe(true);
    return readPng(page, png, "--chart-1");
  };

  test("Copy image puts a PNG of the map on the clipboard", async ({
    page,
  }) => {
    const reading = await copiedReading(page, MAP);
    expect(reading.width).toBeGreaterThan(600);
    expect(reading.corner).toEqual(reading.background);
    expect(reading.seriesPixels).toBeGreaterThan(100);
  });

  test("the picture follows the dark theme", async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem("theme", "dark"),
    );
    await page.emulateMedia({ colorScheme: "dark" });
    const reading = await copiedReading(page, MAP);
    expect(reading.corner).toEqual(reading.background);
    expect(reading.seriesPixels).toBeGreaterThan(100);
  });

  test("the picture keeps the dimmed dots of a zone", async ({ page }) => {
    const full = await copiedReading(page, MAP);
    const zoned = await copiedReading(page, `${MAP}&zone=quickWins`);
    expect(zoned.seriesPixels).toBeGreaterThan(0);
    expect(zoned.seriesPixels).toBeLessThan(full.seriesPixels);
  });

  test("no image without a chart", async ({ page }) => {
    for (const url of [
      "/apps/app-tags/keywords?view=map",
      "/apps/app-unchecked/keywords?view=map",
      `${MAP}&q=zzzz`,
    ]) {
      await page.goto(url);
      await expect(
        page.locator('[data-slot="card"]', { hasText: "Opportunity map" }),
      ).toBeVisible();
      await expect(copyMap(page)).toHaveCount(0);
      await expect(downloadMap(page)).toHaveCount(0);
    }
  });

  test("while a copy runs the button keeps focus", async ({ page }) => {
    await page.goto(MAP);
    await expect(mapRegion(page)).toBeVisible();
    await copyMap(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Chart copied")).toBeVisible();
    await expect(copyMap(page)).toBeFocused();
  });
});
