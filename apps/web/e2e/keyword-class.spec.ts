import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/keywords";

const rowOf = (page: Page, text: string) =>
  page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row")
    .filter({
      has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
    });

test.describe("the keyword type badge", () => {
  test("marks the own brand and the competitor brand and nothing else", async ({
    page,
  }) => {
    await page.goto(PAGE);

    await expect(
      rowOf(page, "focus timer").getByText("Brand keyword"),
    ).toHaveCount(1);
    await expect(
      rowOf(page, "pomodoro").getByText("Competitor brand keyword"),
    ).toHaveCount(1);
    for (const text of ["study timer", "productivity app", "time blocking"]) {
      await expect(rowOf(page, text).getByText(/brand keyword/)).toHaveCount(0);
    }
    await expect(
      page.getByRole("button", { name: "Keyword", exact: true }),
    ).toBeVisible();
  });

  test("sits after the keyword text", async ({ page }) => {
    await page.goto(PAGE);
    const row = rowOf(page, "focus timer");
    const text = await row
      .getByTitle("focus timer", { exact: true })
      .boundingBox();
    const badge = await row
      .getByTitle("Brand keyword", { exact: true })
      .boundingBox();

    expect(text && badge && badge.x >= text.x + text.width).toBe(true);
  });

  for (const width of [320, 375]) {
    test(`keeps the badge visible without widening the page at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);

      await expect(
        rowOf(page, "focus timer").getByTitle("Brand keyword", { exact: true }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
