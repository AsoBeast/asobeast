import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { holdRequest } from "./held-request.mts";
import {
  APP_MAP_GP_ID,
  APP_MAP_ID,
  MAP_DEFAULT_COUNTS,
  MAP_LABELLED,
} from "./keyword-map.mts";
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

const MAP_URL = `${KEYWORDS}?view=map`;
const CHART_HEIGHT_PX = 360;

const mapRegion = (page: Page) =>
  page.getByRole("region", { name: "Keyword opportunity map" });
const mapCard = (page: Page) =>
  page.locator('[data-slot="card"]', { hasText: "Opportunity map" });
const dots = (page: Page) => page.locator("[data-map-keyword]");
const chartSvg = (page: Page) =>
  mapRegion(page).locator("svg.recharts-surface");

async function boxHeight(locator: ReturnType<Page["locator"]>) {
  return (await locator.boundingBox())?.height ?? 0;
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

test.describe("the opportunity map", () => {
  test("the switch", async ({ page }) => {
    await page.goto(KEYWORDS);
    const views = page.getByRole("tablist", { name: "Keyword view" });
    await expect(mapRegion(page)).toHaveCount(0);

    await views.getByRole("tab", { name: "Map" }).click();

    await expect(page).toHaveURL(/view=map/);
    await expect(views.getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(mapRegion(page)).toBeVisible();

    await views.getByRole("tab", { name: "Table" }).click();

    await expect(page).not.toHaveURL(/view=/);
    await expect(mapRegion(page)).toHaveCount(0);
  });

  test("a link opens the map", async ({ page }) => {
    await page.goto(MAP_URL);
    await expect(mapRegion(page)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.reload();
    await expect(mapRegion(page)).toBeVisible();

    await page.goto(`${KEYWORDS}?view=cloud`);
    await expectRows(page, TOTAL);
    await expect(mapRegion(page)).toHaveCount(0);
  });

  test("the map sits above the table", async ({ page }) => {
    await page.goto(MAP_URL);
    const map = await mapRegion(page).boundingBox();
    const table = await page
      .getByRole("table", { name: /Tracked keywords/ })
      .boundingBox();

    expect(map && table && map.y + map.height <= table.y).toBe(true);
    await expectRows(page, TOTAL);
  });

  test("the svg is a named group", async ({ page }) => {
    await page.goto(MAP_URL);
    const svg = chartSvg(page);

    await expect(svg).toHaveAttribute("role", "group");
    await expect(svg).toHaveAttribute("tabindex", "-1");
    await expect(svg).toHaveAccessibleName(
      "Keywords by difficulty and popularity",
    );
    await expect(svg).toHaveAccessibleDescription(/^Tab moves to the dots\./);
  });

  test("one dot per scored keyword", async ({ page }) => {
    await page.goto(MAP_URL);

    await expect(dots(page)).toHaveCount(23);
    await expect(
      page.locator('[data-rank="ranked"][data-shape="circle"]'),
    ).toHaveCount(11);
    await expect(
      page.locator('[data-rank="unranked"][data-shape="circle"]'),
    ).toHaveCount(10);
    await expect(
      page.locator('[data-rank="ranked"][data-shape="diamond"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-rank="unranked"][data-shape="diamond"]'),
    ).toHaveCount(1);
    await expect(page.locator('[data-map-keyword="kw-map-24"]')).toHaveCount(0);
    await expect(page.locator('[data-map-keyword="kw-map-25"]')).toHaveCount(0);
  });

  test("floor rows are diamonds", async ({ page }) => {
    await page.goto("/apps/app-floor/keywords?view=map");
    await expect(page.locator('[data-shape="diamond"]')).toHaveCount(3);
    await expect(page.locator('[data-shape="circle"]')).toHaveCount(1);
    await expect(page.getByRole("list", { name: "Dot shapes" })).toContainText(
      "Popularity at Apple's floor",
    );
  });

  test("google play rows are circles", async ({ page }) => {
    await page.goto(`/apps/${APP_MAP_GP_ID}/keywords?view=map`);
    await expect(dots(page)).toHaveCount(23);
    await expect(mapRegion(page)).toBeVisible();
    await expect(page.locator('[data-shape="diamond"]')).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Dot shapes" }),
    ).not.toContainText("floor");
  });

  test("zones and thresholds are named in the picture", async ({ page }) => {
    await page.goto(MAP_URL);
    const text = chartSvg(page);
    for (const name of [
      "Quick wins",
      "Worth fighting for",
      "Easy pickings",
      "Low priority",
      "Popularity 20",
      "Difficulty 25",
    ]) {
      await expect(text).toContainText(name);
    }
  });

  test("dots follow the other filters", async ({ page }) => {
    await page.goto(`${MAP_URL}&tag=core`);
    await expect(dots(page)).toHaveCount(4);
    await page.goto(`${MAP_URL}&q=timer`);
    await expect(dots(page)).toHaveCount(7);
    await page.goto(`${MAP_URL}&status=paused`);
    await expect(mapCard(page)).toContainText("Too few scored keywords");
    await expect(mapCard(page)).toContainText("1 of 4 so far");
  });

  test("a zone dims, it does not remove", async ({ page }) => {
    await page.goto(`${MAP_URL}&zone=quickWins`);

    await expect(dots(page)).toHaveCount(23);
    await expect(page.locator('[data-dimmed="true"]')).toHaveCount(15);
    await expectRows(page, MAP_DEFAULT_COUNTS.quickWins);
  });

  test("exactly five labels", async ({ page }) => {
    const labels = page.locator("[data-map-label]");
    const labelTexts = () =>
      labels.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-map-label") ?? ""),
      );

    await page.goto(MAP_URL);
    await expect(labels).toHaveCount(5);
    expect((await labelTexts()).sort()).toEqual([...MAP_LABELLED].sort());

    await page.goto(`${MAP_URL}&zone=worthFighting`);
    await expect(labels).toHaveCount(5);
    expect((await labelTexts()).sort()).toEqual(
      [
        "flag trivia",
        "focus app",
        "planner",
        "task manager",
        "time management",
      ].sort(),
    );
  });

  test("states at the real height", async ({ page }) => {
    const notice = (title: string) =>
      mapCard(page).getByText(title, { exact: true }).locator("..");

    await page.goto("/apps/app-tags/keywords?view=map");
    await expect(notice("Too few scored keywords")).toContainText("3 of 4");
    expect(await boxHeight(notice("Too few scored keywords"))).toBe(
      CHART_HEIGHT_PX,
    );

    await page.goto("/apps/app-unchecked/keywords?view=map");
    await expect(notice("Nothing to map yet")).toBeVisible();
    expect(await boxHeight(notice("Nothing to map yet"))).toBe(CHART_HEIGHT_PX);

    await page.goto(`${MAP_URL}&q=zzzz`);
    const filtered = notice("No keywords match these filters");
    await expect(filtered).toBeVisible();
    expect(await boxHeight(filtered)).toBe(CHART_HEIGHT_PX);
    await filtered.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(dots(page)).toHaveCount(23);
  });

  test("loading", async ({ page }) => {
    await page.goto("/apps/app-1/keywords?country=pl&view=map");
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/app-1\/keywords\?country=us/,
      "GET",
    );
    await page
      .getByRole("group", { name: "Keyword markets" })
      .getByRole("button", { name: /^US/ })
      .click();

    const skeleton = page.locator('[data-slot="keyword-map-skeleton"]');
    await expect(skeleton).toBeVisible();
    expect(
      await boxHeight(skeleton.locator('[data-slot="skeleton"]').last()),
    ).toBe(CHART_HEIGHT_PX);

    held.release();
    await expect(mapRegion(page)).toBeVisible();
    expect(await boxHeight(mapRegion(page))).toBe(CHART_HEIGHT_PX);
  });

  test("unscored rows are counted", async ({ page }) => {
    await page.goto(MAP_URL);
    await expect(
      page.getByText("2 keywords without both scores are not on the map."),
    ).toBeVisible();
  });

  for (const width of [320, 375]) {
    test(`no horizontal scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(MAP_URL);
      await expect(dots(page)).toHaveCount(23);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }

  for (const theme of THEMES) {
    test(`keeps contrast in the ${theme} theme`, async ({ page }) => {
      expect(await contrastViolations(page, theme, MAP_URL)).toEqual([]);
    });
  }
});
