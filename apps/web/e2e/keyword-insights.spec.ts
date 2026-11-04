import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_INSIGHTS_ID, INSIGHT_MATRIX } from "./keyword-insights.mts";

const KEYWORDS = "/apps/app-1/keywords";
const BADGES = ["Dropping", "Page 1 close", "Beatable", "Not in listing"];

const keywordRow = (page: Page, text: string) =>
  page.getByRole("row").filter({
    has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
  });

const insightsOfRow = (page: Page, text: string) =>
  keywordRow(page, text).getByRole("group", { name: /^Insights\./ });

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

test("a badge group carries the words and the detail of each badge", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  await expect(insightsOfRow(page, "pomodoro")).toHaveAccessibleName(
    "Insights. Dropping: Fell on 3 checks in a row. Page 1 close: 2 places from the top 10",
  );
  await expect(
    insightsOfRow(page, "pomodoro").getByText("Dropping"),
  ).toHaveAttribute("title", "Fell on 3 checks in a row");
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
