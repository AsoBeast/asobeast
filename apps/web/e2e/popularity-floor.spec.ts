import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-floor/keywords";

const scoreButton = (page: Page, keyword: string, name: RegExp) =>
  page
    .getByRole("row", { name: new RegExp(keyword) })
    .getByRole("button", { name });

const floorPopularity = (page: Page) =>
  scoreButton(page, "world flags", /Popularity 41.*Floor answer, Medium/);

const tooltip = (page: Page) => page.getByRole("tooltip");

test("a floor answer names itself in the popularity button", async ({
  page,
}) => {
  await page.goto(PAGE);

  const button = floorPopularity(page);
  await expect(button).toHaveAccessibleName(
    "Popularity 41, fair. Floor answer, Medium confidence. Show scoring details",
  );
  await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
});

test("the floor tooltip says what Apple answered", async ({ page }) => {
  await page.goto(PAGE);

  await (await hydrated(floorPopularity(page))).focus();

  await expect(tooltip(page)).toContainText(
    "Apple answered its floor value (41) for the week of 18 Oct 2026.",
  );
  await expect(tooltip(page)).toContainText(
    "The last value above the floor was 63 in the week of 6 Sep 2026.",
  );
  await page.keyboard.press("Escape");
  await expect(tooltip(page)).toHaveCount(0);
});

test("the left out tooltip keeps the estimate line", async ({ page }) => {
  await page.goto(PAGE);

  await (
    await hydrated(
      scoreButton(page, "capital cities quiz", /Popularity 38.*Floor answer/),
    )
  ).focus();

  await expect(tooltip(page)).toContainText(
    "Estimated from the first 25 App Store results",
  );
  await expect(tooltip(page)).toContainText(
    "Apple left this term out of its list for the week of 18 Oct 2026, so its popularity is below the floor of 41",
  );
  await expect(tooltip(page)).toContainText(
    "The last value above the floor was 58 in the week of 27 Sep 2026.",
  );
});

test("a left out term never listed in the kept weeks names no last value", async ({
  page,
}) => {
  await page.goto(PAGE);

  await (
    await hydrated(
      scoreButton(page, "flag trivia", /Popularity 30.*Floor answer/),
    )
  ).focus();

  await expect(tooltip(page)).toContainText("below the floor of 41");
  await expect(tooltip(page)).not.toContainText(
    "The last value above the floor",
  );
});

test("a listed term reads as before", async ({ page }) => {
  await page.goto(PAGE);

  const button = scoreButton(
    page,
    "geo quiz",
    /Popularity 71.*High confidence/,
  );
  await expect(button).not.toHaveAccessibleName(/Floor answer/);
  await expect(button.locator("svg")).toHaveCount(0);
  await (await hydrated(button)).focus();
  await expect(tooltip(page)).toContainText(
    "Apple reports a search popularity of 71 for this term.",
  );
});

test("difficulty says it carries lower confidence", async ({ page }) => {
  await page.goto(PAGE);

  await (
    await hydrated(
      scoreButton(page, "world flags", /Difficulty \d+.*Medium confidence/),
    )
  ).focus();

  await expect(tooltip(page)).toContainText("capped at Medium");
});

test("opportunity says it carries lower confidence", async ({ page }) => {
  await page.goto(PAGE);

  await (
    await hydrated(
      scoreButton(
        page,
        "world flags",
        /Opportunity \d+.*Derived score, lower confidence/,
      ),
    )
  ).focus();

  await expect(tooltip(page)).toContainText("read it with lower confidence");
  await expect(
    scoreButton(page, "geo quiz", /Opportunity \d+.*Derived score/),
  ).not.toHaveAccessibleName(/lower confidence/);
});

test("the marker does not break keyboard use", async ({ page }) => {
  await page.goto(PAGE);

  const button = await hydrated(floorPopularity(page));
  await button.focus();
  await page.keyboard.press("Escape");

  await expect(button).toBeFocused();
});

test("the export carries the floor answer", async ({ page }) => {
  await page.goto(PAGE);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of keywords" }).click(),
  ]);
  const lines = readFileSync(await download.path(), "utf8").split("\r\n");

  expect(lines[0]).toContain(
    "officialPopularity,officialPopularityState,officialPopularityFloor,officialPopularityWeek,lastAboveFloorValue,lastAboveFloorWeek,scoreOutdated",
  );
  expect(lines.find((line) => line.startsWith("world flags,"))).toContain(
    "41,floor,41,2026-10-18,63,2026-09-06",
  );
  expect(lines.find((line) => line.startsWith("flag trivia,"))).toContain(
    "absent,41,2026-10-18,,",
  );
});

for (const theme of THEMES) {
  test(`the floor marker keeps contrast in the ${theme} theme`, async ({
    page,
  }) => {
    expect(await contrastViolations(page, theme, PAGE)).toEqual([]);
  });
}

test("a translated page keeps the floor tooltip working", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(PAGE);
  const button = await hydrated(floorPopularity(page));

  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    for (const text of texts.filter((node) => node.data.trim())) {
      const outer = document.createElement("font");
      const inner = document.createElement("font");
      inner.textContent = text.data.toUpperCase();
      outer.append(inner);
      text.replaceWith(outer);
    }
  });
  await button.focus();

  await expect(tooltip(page)).toContainText(/Apple answered its floor value/i);
  await expect(button).toContainText("41");
  expect(errors.filter((message) => /NotFoundError/.test(message))).toEqual([]);
});
