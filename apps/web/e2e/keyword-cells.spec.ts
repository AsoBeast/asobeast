import type { Page } from "@playwright/test";
import { formatDate } from "../src/lib/format";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { APP_MARKS_KEYWORDS } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-marks/keywords";

const rowOf = (page: Page, text: string) =>
  page.getByRole("row").filter({
    has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
  });

const lastRankedTitle = (text: string) => {
  const keyword = APP_MARKS_KEYWORDS.find((row) => row.text === text);
  if (!keyword?.lastRankedOn) throw new Error(`no last ranked day for ${text}`);
  return `Last ranked #${keyword.lastRankedPosition} on ${formatDate(keyword.lastRankedOn)}`;
};

const keywordCell = (page: Page, text: string) =>
  rowOf(page, text).getByRole("cell").nth(1);

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
      table.getByRole("cell", {
        name: "focus timer Brand keyword",
        exact: true,
      }),
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

const STORED_COLUMNS = "asobeast.columns.keywords";

const storedColumns = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "{}") as object,
    STORED_COLUMNS,
  );

const openColumns = async (page: Page) => {
  await (await hydrated(page.getByRole("button", { name: "Columns" }))).click();
  return page.getByRole("menuitemcheckbox", { name: "Listing marks" });
};

test.describe("the listing marks choice", () => {
  test("the Columns menu offers the listing marks, on by default", async ({
    page,
  }) => {
    await openMarks(page);
    const choice = await openColumns(page);
    const menu = page.getByRole("menu");

    await expect(choice).toHaveAttribute("aria-checked", "true");
    for (const [name, tint] of [
      ["Title", /bg-success-subtle/],
      ["Subtitle", /bg-info-subtle/],
      ["Keyword field", /bg-warning-subtle/],
    ] as const) {
      await expect(
        menu.locator("mark").filter({ hasText: new RegExp(`^${name}$`) }),
      ).toHaveClass(tint);
    }
  });

  test("hiding the marks shows plain keywords and remembers it", async ({
    page,
  }) => {
    await openMarks(page);
    const before = await storedColumns(page);
    await (await openColumns(page)).click();
    await page.keyboard.press("Escape");
    const table = page.getByRole("table", { name: /Tracked keywords/ });

    await expect(table.locator("mark")).toHaveCount(0);
    await expect(keywordCell(page, "focus timer")).toHaveAccessibleName(
      "focus timer",
    );
    expect(await storedColumns(page)).toEqual({
      ...before,
      listingMarks: false,
    });

    await page.reload();
    await hydrated(
      page.getByRole("checkbox", { name: "Select focus timer", exact: true }),
    );
    await expect(table.locator("mark")).toHaveCount(0);
    await expect(await openColumns(page)).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("showing them again removes the stored choice", async ({ page }) => {
    await openMarks(page);
    const choice = await openColumns(page);
    await choice.click();
    await expect(choice).toHaveAttribute("aria-checked", "false");
    await choice.click();
    await page.keyboard.press("Escape");

    await expect(keywordCell(page, "focus timer").locator("mark")).toHaveCount(
      1,
    );
    expect(await storedColumns(page)).not.toHaveProperty("listingMarks");
  });

  test("the menu keeps working with the keyboard", async ({ page }) => {
    await openMarks(page);
    const columns = await hydrated(
      page.getByRole("button", { name: "Columns" }),
    );
    await columns.focus();
    await page.keyboard.press("Enter");
    const choice = page.getByRole("menuitemcheckbox", {
      name: "Listing marks",
    });
    await expect(choice).toBeVisible();
    await page.keyboard.press("End");
    await expect(choice).toBeFocused();
    await page.keyboard.press("Space");

    await expect(choice).toHaveAttribute("aria-checked", "false");
    await expect(choice).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(columns).toBeFocused();
    await expect(
      page.getByRole("table", { name: /Tracked keywords/ }).locator("mark"),
    ).toHaveCount(0);
  });

  test("a Google Play app lists title and short description in the legend", async ({
    page,
  }) => {
    await page.goto("/apps/app-gp/keywords");
    await openColumns(page);
    const legend = page.getByRole("menu").locator("mark");

    await expect(legend).toHaveText(["Title", "Short description"]);
  });

  test("the choice is per browser, not part of the link", async ({ page }) => {
    await openMarks(page);
    const address = page.url();
    await (await openColumns(page)).click();
    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("table", { name: /Tracked keywords/ }).locator("mark"),
    ).toHaveCount(0);
    expect(page.url()).toBe(address);
  });
});

test.describe("the last position of a keyword that lost its rank", () => {
  test("a keyword that lost its rank says where it was", async ({ page }) => {
    await openMarks(page);
    const position = rowOf(page, "lost yesterday").getByText(">200 (was #14)", {
      exact: true,
    });

    await expect(position).toBeVisible();
    await expect(position).toHaveAttribute(
      "title",
      lastRankedTitle("lost yesterday"),
    );
    await expect(
      rowOf(page, "lost yesterday").getByText(/since yesterday/),
    ).toHaveCount(0);
  });

  test("the hint outlives the first day", async ({ page }) => {
    await openMarks(page);

    await expect(
      rowOf(page, "lost for days").getByText(">200 (was #9)", { exact: true }),
    ).toHaveAttribute("title", lastRankedTitle("lost for days"));
  });

  test("an older api still shows the day before", async ({ page }) => {
    await openMarks(page);
    const position = rowOf(page, "lost on an older api").getByText(
      ">200 (was #6)",
      { exact: true },
    );

    await expect(position).toBeVisible();
    await expect(position).not.toHaveAttribute("title");
  });

  test("a keyword that never ranked shows no hint", async ({ page }) => {
    await openMarks(page);
    const row = rowOf(page, "never ranked");

    await expect(row.getByText(">200", { exact: true })).toBeVisible();
    await expect(row).not.toContainText("(was");
  });

  test("the position history popover keeps its own readout", async ({
    page,
  }) => {
    await openMarks(page);
    await rowOf(page, "lost yesterday")
      .getByRole("button", { name: "Position history: lost yesterday" })
      .click();
    const history = page.getByRole("dialog", {
      name: "Position history lost yesterday",
    });

    await expect(history).toBeVisible();
    await expect(history.getByText(">200", { exact: true })).toBeVisible();
    await expect(history).not.toContainText("(was");
  });

  test("the position history popover names the day of the lost position", async ({
    page,
  }) => {
    await openMarks(page);
    await rowOf(page, "lost yesterday")
      .getByRole("button", { name: "Position history: lost yesterday" })
      .press("Enter");
    const history = page.getByRole("dialog", {
      name: "Position history lost yesterday",
    });

    await expect(
      history.getByText(lastRankedTitle("lost yesterday"), { exact: true }),
    ).toBeVisible();
  });

  test("the position history popover names the day after several unranked checks", async ({
    page,
  }) => {
    await openMarks(page);
    await rowOf(page, "lost for days")
      .getByRole("button", { name: "Position history: lost for days" })
      .press("Enter");
    const history = page.getByRole("dialog", {
      name: "Position history lost for days",
    });

    await expect(
      history.getByText(lastRankedTitle("lost for days"), { exact: true }),
    ).toBeVisible();
  });

  test("the position history popover of an older api names no day", async ({
    page,
  }) => {
    await openMarks(page);
    await rowOf(page, "lost on an older api")
      .getByRole("button", { name: "Position history: lost on an older api" })
      .click();
    const history = page.getByRole("dialog", {
      name: "Position history lost on an older api",
    });

    await expect(history).toBeVisible();
    await expect(history).not.toContainText("Last ranked");
  });

  for (const width of [320, 375]) {
    test(`the hint never widens the page at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openMarks(page);
      await expect(
        rowOf(page, "lost on an older api").getByText(">200 (was #6)"),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
