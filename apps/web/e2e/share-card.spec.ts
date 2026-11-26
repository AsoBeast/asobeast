import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { RankingSeries } from "@asobeast/shared";
import {
  canvasPixel,
  clipboardPng,
  hexPixel,
  isPng,
  pngSize,
  withoutImageClipboard,
} from "./chart-image.mts";
import { utcDaysAgo } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { cardLayout } from "../src/lib/chart-image/share-card/card-layout";
import { CARD_THEMES } from "../src/lib/chart-image/share-card/card-themes";
import {
  headlineSentence,
  rankingsHeadline,
  type ShareHeadline,
  visibilityHeadline,
} from "../src/lib/chart-image/share-card/headline";

const RANKINGS_PAGE = "/apps/app-1/rankings";
const RANKINGS = /\/api\/backend\/apps\/app-1\/rankings\?/;
const ALL_PARTS = { change: true, app: true, footer: true };

const rankingsChart = (page: Page) =>
  page.getByRole("region", { name: "Keyword rank positions" });
const shareButton = (page: Page) =>
  page.getByRole("button", { name: "Share the rankings chart", exact: true });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Share the rankings chart" });
const preview = (page: Page) => dialog(page).getByRole("img");

async function rankingsOverSevenDays(page: Page): Promise<ShareHeadline> {
  await page.goto(RANKINGS_PAGE);
  await expect(rankingsChart(page)).toBeVisible();
  const answer = page.waitForResponse(RANKINGS);
  await page
    .getByRole("tablist", { name: "Date range" })
    .getByRole("tab", { name: "7d" })
    .click();
  const { series } = (await (await answer).json()) as RankingSeries;
  const headline = rankingsHeadline(series);
  if (!headline) throw new Error("The fixture draws no rankings card");
  await expect(rankingsChart(page)).toBeVisible();
  return headline;
}

async function openShare(page: Page) {
  await (await hydrated(shareButton(page))).click();
  await expect(dialog(page)).toBeVisible();
  await expect(preview(page)).not.toHaveAttribute("aria-busy", "true");
}

const pick = (page: Page, list: string, option: string) =>
  dialog(page)
    .getByRole("tablist", { name: list })
    .getByRole("tab", { name: option })
    .click();

const canvasSize = (page: Page) =>
  preview(page).evaluate((element) =>
    element instanceof HTMLCanvasElement
      ? { width: element.width, height: element.height }
      : null,
  );

test.beforeEach(({ context }) =>
  context.grantPermissions(["clipboard-read", "clipboard-write"]),
);

test.describe("rankings", () => {
  test("offers a card beside the chart image buttons", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await expect(rankingsChart(page)).toBeVisible();

    const download = page.getByRole("button", {
      name: "Download PNG of the rankings chart",
    });
    await expect(shareButton(page)).toBeVisible();
    expect(
      await download.evaluate(
        (element, share) =>
          share !== null &&
          (element.compareDocumentPosition(share) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
            0,
        await shareButton(page).elementHandle(),
      ),
    ).toBe(true);
  });

  test("previews the card with its headline", async ({ page }) => {
    const headline = await rankingsOverSevenDays(page);

    await openShare(page);

    await expect(dialog(page)).toHaveAccessibleDescription(
      "Pick a size and a theme, then copy or download the card.",
    );
    await expect(preview(page)).toHaveAccessibleName(
      headlineSentence(headline, true),
    );
    await expect(preview(page)).not.toHaveAccessibleName(/focus timer/);
  });

  test("links the guide to share cards", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);

    await expect(
      dialog(page).getByRole("link", { name: "Read about share cards" }),
    ).toHaveAttribute(
      "href",
      "https://docs.asobeast.com/guides/read-rankings#share-a-card",
    );
  });

  test("switches size", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);
    await expect
      .poll(() => canvasSize(page))
      .toEqual({
        width: 1200,
        height: 675,
      });

    await pick(page, "Size", "1:1");
    await expect
      .poll(() => canvasSize(page))
      .toEqual({
        width: 1080,
        height: 1080,
      });

    await pick(page, "Size", "4:5");
    await expect
      .poll(() => canvasSize(page))
      .toEqual({
        width: 1080,
        height: 1350,
      });
  });

  test("switches theme", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);
    const corner = () => canvasPixel(preview(page), 4, 4);
    await expect.poll(corner).toEqual(hexPixel(CARD_THEMES.light.background));

    await pick(page, "Theme", "Dark");
    await expect.poll(corner).toEqual(hexPixel(CARD_THEMES.dark.background));

    await pick(page, "Theme", "Orange");
    await expect.poll(corner).toEqual(hexPixel(CARD_THEMES.orange.background));
  });

  test("turns the footer off", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);
    const { mark } = cardLayout("landscape", ALL_PARTS);
    if (!mark) throw new Error("The layout has no mark");
    const markTop = () =>
      canvasPixel(preview(page), mark.x + mark.width / 2, mark.y + 6);
    const background = hexPixel(CARD_THEMES.light.background);
    await expect.poll(markTop).not.toEqual(background);

    await dialog(page)
      .getByRole("switch", { name: "Show Made with AsoBeast" })
      .click();

    await expect.poll(markTop).toEqual(background);
    expect(
      cardLayout("landscape", { ...ALL_PARTS, footer: false }).chart.height,
    ).toBeGreaterThan(cardLayout("landscape", ALL_PARTS).chart.height);
  });

  test("downloads the card at its size", async ({ page }) => {
    const headline = await rankingsOverSevenDays(page);
    await openShare(page);
    await pick(page, "Size", "1:1");

    const [file] = await Promise.all([
      page.waitForEvent("download"),
      dialog(page).getByRole("button", { name: "Download PNG" }).click(),
    ]);

    expect(file.suggestedFilename()).toBe(
      `asobeast-rankings-card-focus-timer-${headline.from}-${headline.to}-square.png`,
    );
    const bytes = readFileSync((await file.path()) ?? "");
    expect(isPng(bytes)).toBe(true);
    expect(await pngSize(page, bytes)).toEqual({ width: 1080, height: 1080 });
  });

  test("copies the card", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);

    await dialog(page).getByRole("button", { name: "Copy image" }).click();
    await expect(page.getByText("Chart copied")).toBeVisible();

    const png = await clipboardPng(page);
    expect(isPng(png)).toBe(true);
    expect(await pngSize(page, png)).toEqual({ width: 1200, height: 675 });
  });

  test("downloads when the clipboard cannot take an image", async ({
    page,
  }) => {
    await withoutImageClipboard(page);
    await page.goto(RANKINGS_PAGE);
    await openShare(page);

    const [file] = await Promise.all([
      page.waitForEvent("download"),
      dialog(page).getByRole("button", { name: "Copy image" }).click(),
    ]);

    expect(file.suggestedFilename()).toMatch(
      /^asobeast-rankings-card-focus-timer-.*-landscape\.png$/,
    );
    await expect(
      page.getByText("Clipboard unavailable, downloaded instead"),
    ).toBeVisible();
  });

  test("remembers the choices", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);
    await pick(page, "Theme", "Dark");
    await pick(page, "Size", "4:5");
    await page.keyboard.press("Escape");

    await page.reload();
    await openShare(page);

    for (const [list, option] of [
      ["Theme", "Dark"],
      ["Size", "4:5"],
    ]) {
      await expect(
        dialog(page)
          .getByRole("tablist", { name: list })
          .getByRole("tab", { name: option }),
      ).toHaveAttribute("aria-selected", "true");
    }
    await expect
      .poll(() => canvasSize(page))
      .toEqual({
        width: 1080,
        height: 1350,
      });
  });

  test("offers no card under four checked days", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await expect(shareButton(page)).toBeVisible();
    await page.route(RANKINGS, (route) =>
      route.fulfill({
        json: {
          series: [
            {
              keywordId: "kw-1",
              text: "focus timer",
              store: "APP_STORE",
              country: "us",
              points: [2, 1, 0].map((days) => ({
                date: utcDaysAgo(days),
                position: 4,
                depth: 200,
              })),
            },
          ],
        },
      }),
    );

    await page
      .getByRole("tablist", { name: "Date range" })
      .getByRole("tab", { name: "7d" })
      .click();

    await expect(
      page.getByText("Not enough history for a trend"),
    ).toBeVisible();
    await expect(shareButton(page)).toHaveCount(0);
  });

  test("returns focus to Share when closed", async ({ page }) => {
    await page.goto(RANKINGS_PAGE);
    await openShare(page);

    await page.keyboard.press("Escape");

    await expect(dialog(page)).toBeHidden();
    await expect(shareButton(page)).toBeFocused();
  });

  test("draws the placeholder tile when the app has no icon", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(RANKINGS_PAGE);
    await openShare(page);
    const { icon } = cardLayout("landscape", ALL_PARTS);
    if (!icon) throw new Error("The layout has no icon");

    await expect
      .poll(() =>
        canvasPixel(
          preview(page),
          icon.x + icon.width / 2,
          icon.y + icon.height / 2,
        ),
      )
      .toEqual(hexPixel(CARD_THEMES.light.line));
    expect(errors.filter((text) => text.includes("SecurityError"))).toEqual([]);
  });
});

test.describe("visibility", () => {
  const OVERVIEW = "/apps/app-1";
  const HISTORY = /\/api\/backend\/apps\/app-1\/visibility-history\?/;
  const share = (page: Page) =>
    page.getByRole("button", {
      name: "Share the visibility chart",
      exact: true,
    });
  const visibilityDialog = (page: Page) =>
    page.getByRole("dialog", { name: "Share the visibility chart" });
  const visibilityChart = (page: Page) =>
    page.getByRole("region", { name: "Search visibility over time" });
  const points = (values: readonly number[]) =>
    values.map((visibility, index) => ({
      date: utcDaysAgo(values.length - 1 - index),
      visibility,
    }));

  async function answerOver90Days(page: Page, values: readonly number[]) {
    await page.route(HISTORY, (route) =>
      route.fulfill({ json: { points: points(values) } }),
    );
    await page
      .locator('[data-slot="card"]')
      .filter({ has: visibilityChart(page) })
      .getByRole("tab", { name: "90d" })
      .click();
  }

  test("offers a card on the visibility chart", async ({ page }) => {
    const values = [48, 50, 47, 55, 58, 61, 64];
    await page.goto(OVERVIEW);
    await expect(visibilityChart(page)).toBeVisible();
    await answerOver90Days(page, values);
    const headline = visibilityHeadline(points(values));
    if (!headline) throw new Error("The fixture draws no visibility card");

    await (await hydrated(share(page))).click();

    await expect(visibilityDialog(page).getByRole("img")).toHaveAccessibleName(
      headlineSentence(headline, true),
    );
  });

  test("downloads the visibility card", async ({ page }) => {
    await page.goto(OVERVIEW);
    await (await hydrated(share(page))).click();
    await expect(visibilityDialog(page).getByRole("img")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );

    const [file] = await Promise.all([
      page.waitForEvent("download"),
      visibilityDialog(page)
        .getByRole("button", { name: "Download PNG" })
        .click(),
    ]);

    expect(file.suggestedFilename()).toMatch(
      /^asobeast-visibility-card-focus-timer-.*-landscape\.png$/,
    );
  });

  for (const view of ["share", "top10", "rating"]) {
    test(`offers no card for the ${view} figure`, async ({ page }) => {
      await page.goto(`${OVERVIEW}?visView=${view}`);
      await expect(
        page.getByRole("tab", { name: "90d" }).first(),
      ).toBeVisible();

      await expect(share(page)).toHaveCount(0);
    });
  }

  test("offers no card under four captured days", async ({ page }) => {
    await page.goto(OVERVIEW);
    await expect(share(page)).toBeVisible();

    await answerOver90Days(page, [10, 12, 14]);

    await expect(page.getByText("Latest visibility")).toBeVisible();
    await expect(share(page)).toHaveCount(0);
  });
});

test.describe("position history", () => {
  const KEYWORDS = "/apps/app-1/keywords";
  const historyTrigger = (page: Page) =>
    page.getByRole("button", { name: /^Position history: focus timer/ });
  const popover = (page: Page) =>
    page.getByRole("dialog", { name: "Position history focus timer" });
  const shareIcon = (page: Page) =>
    page.getByRole("button", {
      name: "Share the position history of focus timer",
      exact: true,
    });
  const keywordDialog = (page: Page) =>
    page.getByRole("dialog", {
      name: "Share the position history of focus timer",
    });

  async function openHistory(page: Page) {
    await page.goto(KEYWORDS);
    await (await hydrated(historyTrigger(page))).click();
    await expect(popover(page)).toBeVisible();
  }

  test("offers a card beside the position history image button", async ({
    page,
  }) => {
    await openHistory(page);

    await expect(shareIcon(page)).toBeVisible();
    await expect(
      popover(page).getByRole("button", {
        name: "Copy image of the position history of focus timer",
      }),
    ).toBeVisible();
  });

  test("keeps the popover open behind the dialog", async ({ page }) => {
    await openHistory(page);

    await shareIcon(page).click();

    await expect(keywordDialog(page)).toBeVisible();
    await expect(
      page.getByRole("dialog", {
        name: "Position history focus timer",
        includeHidden: true,
      }),
    ).toBeVisible();
  });

  test("names the keyword only on this card", async ({ page }) => {
    await openHistory(page);
    await shareIcon(page).click();

    await expect(keywordDialog(page).getByRole("img")).toHaveAccessibleName(
      /for “focus timer”/,
    );
  });

  test("returns focus to the share button", async ({ page }) => {
    await openHistory(page);
    await shareIcon(page).click();
    await expect(keywordDialog(page).getByRole("img")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );

    await page.keyboard.press("Escape");

    await expect(keywordDialog(page)).toBeHidden();
    await expect(popover(page)).toBeVisible();
    await expect(shareIcon(page)).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(popover(page)).toBeHidden();
    await expect(historyTrigger(page)).toBeFocused();
  });

  test("shares from the keyword sheet", async ({ page }) => {
    await page.goto(`${KEYWORDS}?keyword=kw-1`);
    await (await hydrated(shareIcon(page))).click();
    await expect(keywordDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(keywordDialog(page)).toBeHidden();
    await expect(shareIcon(page)).toBeFocused();
  });
});
