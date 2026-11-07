import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { APP_INSIGHTS_ID, INSIGHT_MATRIX } from "./keyword-insights.mts";

const KEYWORDS = "/apps/app-1/keywords";
const BADGES = ["Dropping", "Page 1 close", "Beatable", "Not in listing"];

const keywordRow = (page: Page, text: string) =>
  page.getByRole("row").filter({
    has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
  });

const insightsOfRow = (page: Page, text: string) =>
  keywordRow(page, text).getByRole("group", { name: "Insights", exact: true });

async function badgesOf(page: Page, text: string): Promise<string[]> {
  const group = insightsOfRow(page, text);
  if ((await group.count()) === 0) return [];
  const words = await group.innerText();
  return BADGES.filter((badge) => words.includes(badge)).sort(
    (left, right) => words.indexOf(left) - words.indexOf(right),
  );
}

const insightsHeader = (page: Page) =>
  page.getByRole("columnheader", { name: /^Insights/ });

test("the Insights column judges every keyword of the app", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await expect(insightsHeader(page)).toBeVisible();
  await expect
    .poll(() => badgesOf(page, "pomodoro"))
    .toEqual(["Dropping", "Page 1 close"]);
  expect(await badgesOf(page, "focus timer")).toEqual(["Beatable"]);
  expect(await badgesOf(page, "productivity app")).toEqual([
    "Beatable",
    "Not in listing",
  ]);
  expect(await badgesOf(page, "study timer")).toEqual(["Beatable"]);
  expect(await badgesOf(page, "time blocking")).toEqual([]);
});

test("a badge group names its badges and leaves the reasons to its popover", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  const group = insightsOfRow(page, "pomodoro");

  await expect(group).toHaveAccessibleName("Insights");
  await expect(group.getByRole("button")).toHaveAccessibleName(
    "Dropping, Page 1 close: reasons for pomodoro (US)",
  );
  await expect(group.getByText("Fell on 3 checks in a row")).toHaveCount(0);
});

test("the reasons of a badge group open from the keyboard", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  const reasons = insightsOfRow(page, "pomodoro").getByRole("button", {
    name: "Dropping, Page 1 close: reasons for pomodoro (US)",
  });

  await (await hydrated(reasons)).focus();
  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", { name: "Insights" });

  await expect(popover).toBeVisible();
  await expect(popover).toHaveAccessibleDescription("pomodoro (US)");
  await expect(popover.getByRole("listitem")).toHaveText([
    "Dropping: Fell on 3 checks in a row",
    "Page 1 close: 2 places from the top 10",
  ]);
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(reasons).toBeFocused();
});

test("each rule badges only the rows past its boundary", async ({ page }) => {
  await page.goto(`/apps/${APP_INSIGHTS_ID}/keywords`);
  await expect(keywordRow(page, "streak 3")).toBeVisible();

  for (const [text, badges] of Object.entries(INSIGHT_MATRIX)) {
    expect([text, await badgesOf(page, text)]).toEqual([text, badges]);
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the column starts hidden and the Columns menu brings it back for good", async ({
    page,
  }) => {
    await page.goto(KEYWORDS);
    await expect(keywordRow(page, "pomodoro")).toBeVisible();
    await expect(insightsHeader(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Insights" }).click();
    await page.keyboard.press("Escape");

    await expect(insightsHeader(page)).toBeVisible();
    await page.reload();
    await expect(insightsHeader(page)).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("asobeast.columns.keywords"),
      ),
    ).toContain('"insights":true');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

test("a viewer whose stored columns predate the column still sees it", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "asobeast.columns.keywords",
      JSON.stringify({ added: true }),
    ),
  );
  await page.goto(KEYWORDS);

  await expect(insightsHeader(page)).toBeVisible();
});

const footer = (page: Page) => page.locator("tfoot");

const keywordTotal = (page: Page) => footer(page).getByText(/^\d+ keywords?$/);

test.describe("the totals row", () => {
  test("totals the keywords of the app under the table", async ({ page }) => {
    await page.goto(KEYWORDS);

    await expect(keywordTotal(page)).toHaveText("5 keywords");
    await expect(footer(page)).toContainText("4 ranked, 1 not found");
    await expect(footer(page)).not.toContainText("not checked");
    await expect(footer(page)).toContainText("avg 16.8");
    await expect(footer(page)).toContainText("2 in the top 10");
    await expect(footer(page)).toContainText("avg 6250");
    await expect(footer(page)).toContainText("avg 55");
    await expect(footer(page).getByRole("row")).toHaveAttribute(
      "aria-rowindex",
      "7",
    );
    await expect(
      page.getByRole("table", { name: /Tracked keywords/ }),
    ).toHaveAttribute("aria-rowcount", "7");
  });

  test("follows the search and every filter", async ({ page }) => {
    await page.goto(KEYWORDS);
    const search = page.getByRole("textbox", { name: "Search keywords" });

    await search.fill("timer");
    await expect(keywordTotal(page)).toHaveText("2 keywords");
    await search.fill("");
    await expect(keywordTotal(page)).toHaveText("5 keywords");

    await page.getByRole("button", { name: "Filter by position" }).click();
    await page.getByRole("option", { name: /^Top 3/ }).click();
    await page.keyboard.press("Escape");
    await expect(keywordTotal(page)).toHaveText("1 keyword");
    await page.getByRole("button", { name: /^Remove Position/ }).click();
    await expect(keywordTotal(page)).toHaveText("5 keywords");

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Paused" }).click();
    await expect(keywordTotal(page)).toHaveText("1 keyword");
    await expect(footer(page)).toContainText("avg 45");
    await search.fill("time");
    await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(keywordTotal(page)).toHaveText("5 keywords");
  });

  test("leaves the table without a totals row when nothing matches", async ({
    page,
  }) => {
    await page.goto(KEYWORDS);

    await page
      .getByRole("textbox", { name: "Search keywords" })
      .fill("no such keyword");

    await expect(
      page.getByText("No keywords match these filters"),
    ).toBeVisible();
    await expect(footer(page)).toHaveCount(0);
  });

  test("hides the total of a hidden column", async ({ page }) => {
    await page.goto(KEYWORDS);
    await expect(footer(page)).toContainText("avg 6250");

    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Popularity" }).click();
    await page.keyboard.press("Escape");

    await expect(footer(page)).not.toContainText("avg 6250");
    await expect(footer(page)).toContainText("avg 55");
    await expect(keywordTotal(page)).toHaveText("5 keywords");
  });

  test("stays at the bottom of a long table and totals every row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1800 });
    await page.goto("/apps/app-bulk/keywords");
    await expect(keywordTotal(page)).toHaveText("500 keywords");

    const scroller = page.locator('[data-slot="table-container"]');
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight / 2;
    });

    await expect(keywordTotal(page)).toBeInViewport();
    const [area, row] = await Promise.all([
      scroller.boundingBox(),
      footer(page).boundingBox(),
    ]);
    expect(
      Math.abs(
        (area?.y ?? 0) +
          (area?.height ?? 0) -
          ((row?.y ?? 0) + (row?.height ?? 0)),
      ),
    ).toBeLessThan(2);
    expect(
      await footer(page).evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toMatch(/rgba\(.*, 0(\.\d+)?\)$/);
  });

  for (const width of [320, 375]) {
    test(`shows the keyword and position totals at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(KEYWORDS);

      await expect(keywordTotal(page)).toBeVisible();
      await expect(footer(page)).toContainText("avg 16.8");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
});
