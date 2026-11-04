import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { APP_MAP_ID, MAP_DEFAULT_COUNTS } from "./keyword-map.mts";
import { expect, test } from "./session.mts";

const KEYWORDS = `/apps/${APP_MAP_ID}/keywords`;
const TOTAL = 25;

const rowBoxes = (page: Page) =>
  page.getByRole("checkbox", { name: /^Select (?!all keywords)/ });

async function shownKeywords(page: Page): Promise<string[]> {
  const labels = await rowBoxes(page).evaluateAll((boxes) =>
    boxes.map((box) => box.getAttribute("aria-label") ?? ""),
  );
  return labels.map((label) => label.replace(/^Select /, ""));
}

async function expectRows(page: Page, count: number) {
  await expect(page.getByText(`${count} of ${TOTAL} keywords`)).toBeVisible();
  await expect(rowBoxes(page)).toHaveCount(count);
}

const storeThresholds = (page: Page, raw: string) =>
  page.addInitScript((value) => {
    window.localStorage.setItem("asobeast.map.thresholds", value);
  }, raw);

test.describe("the zone filter", () => {
  test("zone counts of the fixture", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins);
    await page.goto(`${KEYWORDS}?zone=worthFighting`);
    await expectRows(page, MAP_DEFAULT_COUNTS.worthFighting);
    await page.goto(`${KEYWORDS}?zone=easyPickings`);
    await expectRows(page, MAP_DEFAULT_COUNTS.easyPickings);
    await page.goto(`${KEYWORDS}?zone=lowPriority`);
    await expectRows(page, MAP_DEFAULT_COUNTS.lowPriority);
    await page.goto(KEYWORDS);
    await expectRows(page, TOTAL);
  });

  test("a zone names its chip and clears", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    const chips = page.getByRole("list", { name: "Active filters" });
    await expect(chips).toContainText("Zone: Quick wins");

    await page.getByRole("button", { name: "Remove Zone: Quick wins" }).click();

    await expectRows(page, TOTAL);
    await expect(page).not.toHaveURL(/zone=/);

    await page.goto(`${KEYWORDS}?zone=quickWins&status=active`);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins - 1);
    await page.getByRole("button", { name: "Clear all" }).click();

    await expectRows(page, TOTAL);
    await expect(page).not.toHaveURL(/zone=|status=/);
  });

  test("an unknown zone is ignored", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=sideways`);

    await expectRows(page, TOTAL);
    await expect(
      page.getByRole("list", { name: "Active filters" }),
    ).toHaveCount(0);
  });

  test("unscored rows have no zone", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins);

    const shown = await shownKeywords(page);
    expect(shown).not.toContain("new phrase one");
    expect(shown).not.toContain("half scored");
  });

  test("the zone follows the other filters", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=quickWins&tag=core`);
    await expectRows(page, 3);
    expect((await shownKeywords(page)).sort()).toEqual([
      "focus timer",
      "habit timer",
      "study timer",
    ]);

    await page.goto(`${KEYWORDS}?zone=quickWins&status=paused`);
    await expectRows(page, 1);
    expect(await shownKeywords(page)).toEqual(["paused phrase"]);
  });

  test("the boundaries land on the better side", async ({ page }) => {
    const zoneHolds = async (zone: string, keywords: string[]) => {
      await page.goto(`${KEYWORDS}?zone=${zone}`);
      await expect(rowBoxes(page).first()).toBeVisible();
      const shown = await shownKeywords(page);
      for (const keyword of keywords) expect(shown).toContain(keyword);
    };

    await zoneHolds("quickWins", ["deep work timer", "exam countdown"]);
    await zoneHolds("worthFighting", ["focus app"]);
    await zoneHolds("easyPickings", ["pomodoro tracker"]);
    await zoneHolds("lowPriority", ["stopwatch"]);
  });

  test("stored thresholds apply", async ({ page }) => {
    await storeThresholds(page, '{"popularity":30,"difficulty":25}');
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, 6);
    await page.goto(`${KEYWORDS}?zone=easyPickings`);
    await expectRows(page, 6);
  });

  test("a stricter difficulty narrows quick wins", async ({ page }) => {
    await storeThresholds(page, '{"popularity":20,"difficulty":20}');
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, 5);
  });

  test("a stored value that does not parse is the default", async ({
    page,
  }) => {
    await storeThresholds(page, "not json");
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins);
  });

  test("blocked storage still works", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto(`${KEYWORDS}?zone=quickWins`);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins);
  });

  test("the CSV follows the zone", async ({ page }) => {
    await page.goto(`${KEYWORDS}?zone=lowPriority`);
    await expectRows(page, MAP_DEFAULT_COUNTS.lowPriority);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV of keywords" }).click(),
    ]);
    const lines = readFileSync(await download.path(), "utf8")
      .split("\r\n")
      .filter((line) => line.length > 0);

    expect(lines).toHaveLength(MAP_DEFAULT_COUNTS.lowPriority + 1);
  });
});
