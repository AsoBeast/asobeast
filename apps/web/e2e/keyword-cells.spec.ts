import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-marks/keywords";

const keywordCell = (page: Page, text: string) =>
  page
    .getByRole("row")
    .filter({
      has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
    })
    .getByRole("cell")
    .nth(1);

const openMarks = async (page: Page) => {
  await page.goto(PAGE);
  await hydrated(
    page.getByRole("checkbox", { name: "Select focus timer", exact: true }),
  );
};

test.describe("listing marks in the keyword cell", () => {
  test("a title mark is one phrase and says where it is", async ({ page }) => {
    await openMarks(page);
    const cell = keywordCell(page, "focus timer");
    const marks = cell.locator("mark");

    await expect(marks).toHaveCount(1);
    await expect(marks.first()).toHaveClass(/bg-success-subtle/);
    await expect(marks.first()).toContainText("focus timer");
    await expect(cell).toHaveAccessibleName("focus timer (in title)");
    await expect(cell.locator("[title]").first()).toHaveAttribute(
      "title",
      "focus timer",
    );
  });

  test("words found in two places get two tints and two labels", async ({
    page,
  }) => {
    await openMarks(page);
    const marks = keywordCell(page, "focus study").locator("mark");

    await expect(marks).toHaveCount(2);
    await expect(marks.nth(0)).toHaveClass(/bg-success-subtle/);
    await expect(marks.nth(0)).toContainText("(in title)");
    await expect(marks.nth(1)).toHaveClass(/bg-info-subtle/);
    await expect(marks.nth(1)).toContainText("(in subtitle)");
  });

  test("the keyword field mark is amber", async ({ page }) => {
    await openMarks(page);
    const marks = keywordCell(page, "habit tracker").locator("mark");

    await expect(marks).toHaveCount(1);
    await expect(marks.first()).toHaveClass(/bg-warning-subtle/);
    await expect(marks.first()).toContainText("(in keyword field)");
  });

  test("a folded word is dotted and says why", async ({ page }) => {
    await openMarks(page);
    const marks = keywordCell(page, "cafe finder").locator("mark");

    await expect(marks.nth(0)).toHaveClass(/decoration-dotted/);
    await expect(marks.nth(0)).toContainText("(in subtitle, accents differ)");
    await expect(marks.nth(1)).toHaveClass(/decoration-solid/);
  });

  test("a keyword the listing does not hold stays plain", async ({ page }) => {
    await openMarks(page);
    const cell = keywordCell(page, "unrelated words");

    await expect(cell.locator("mark")).toHaveCount(0);
    await expect(cell).toHaveAccessibleName("unrelated words");
  });

  test("a paused keyword is marked and still says Paused", async ({ page }) => {
    await openMarks(page);
    const cell = keywordCell(page, "pomodoro tracker");

    await expect(cell.locator("mark")).toHaveCount(2);
    await expect(cell.getByText("Paused", { exact: true })).toBeVisible();
    await expect(cell.getByRole("button", { name: /^Note:/ })).toBeVisible();
  });

  test("an app without marks draws the cells as before", async ({ page }) => {
    await page.goto("/apps/app-1/keywords");
    const table = page.getByRole("table", { name: /Tracked keywords/ });

    await expect(
      table.getByRole("cell", { name: "focus timer", exact: true }),
    ).toBeVisible();
    await expect(table.locator("mark")).toHaveCount(0);
  });

  for (const width of [320, 375]) {
    test(`a marked keyword never widens the page at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await openMarks(page);
      await expect(
        keywordCell(page, "focus study").locator("mark"),
      ).toHaveCount(2);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  for (const theme of THEMES) {
    test(`the marks keep the text contrast in the ${theme} theme`, async ({
      page,
    }) => {
      expect(await contrastViolations(page, theme, PAGE)).toEqual([]);
    });
  }
});
