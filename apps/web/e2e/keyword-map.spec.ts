import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
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
    await expect(mapCard(page)).toContainText("These filters leave 1.");
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

const legend = (page: Page) => page.getByRole("list", { name: "Zones" });
const toggle = (page: Page, name: string) =>
  legend(page).getByRole("button", {
    name: new RegExp(`^${name} \\d+ keyword`),
  });

async function expectToggles(page: Page, counts: number[]) {
  const names = [
    "Quick wins",
    "Worth fighting for",
    "Easy pickings",
    "Low priority",
  ];
  for (const [index, name] of names.entries()) {
    await expect(toggle(page, name)).toHaveAccessibleName(
      `${name} ${counts[index]} ${counts[index] === 1 ? "keyword" : "keywords"}`,
    );
  }
}

async function openThresholds(page: Page) {
  await page.getByRole("button", { name: "Thresholds" }).click();
  const dialog = page.getByRole("dialog", { name: "Zone thresholds" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const blockStorage = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });

test.describe("zones and thresholds", () => {
  test("four toggles with counts", async ({ page }) => {
    await page.goto(MAP_URL);
    await expectToggles(page, [8, 7, 4, 4]);
    for (const name of [
      "Quick wins",
      "Worth fighting for",
      "Easy pickings",
      "Low priority",
    ]) {
      await expect(toggle(page, name)).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("a toggle presses a zone", async ({ page }) => {
    await page.goto(MAP_URL);

    await toggle(page, "Quick wins").click();
    await expect(page).toHaveURL(/zone=quickWins/);
    await expect(toggle(page, "Quick wins")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectRows(page, 8);
    await expect(
      page.getByRole("list", { name: "Active filters" }),
    ).toContainText("Zone: Quick wins");
    await expect(page.locator('[data-dimmed="true"]')).toHaveCount(15);

    await toggle(page, "Quick wins").click();
    await expect(page).not.toHaveURL(/zone=/);

    await toggle(page, "Quick wins").click();
    await toggle(page, "Easy pickings").click();
    await expect(page).toHaveURL(/zone=easyPickings/);
    await expect(
      page.getByRole("list", { name: "Active filters" }).getByRole("listitem"),
    ).toHaveCount(1);
  });

  test("the keyboard presses it and keeps focus", async ({ page }) => {
    await page.goto(MAP_URL);
    const quickWins = toggle(page, "Quick wins");
    await quickWins.focus();

    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/zone=quickWins/);
    await expectRows(page, 8);
    await expect(quickWins).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/zone=/);
    await expectRows(page, TOTAL);
    await expect(quickWins).toBeFocused();
  });

  test("counts follow the other filters", async ({ page }) => {
    await page.goto(`${MAP_URL}&tag=core`);
    await expectToggles(page, [3, 1, 0, 0]);
    await toggle(page, "Quick wins").click();
    await expectToggles(page, [3, 1, 0, 0]);
  });

  test("unplotted keywords are in no zone", async ({ page }) => {
    await page.goto(MAP_URL);
    const table = page.getByRole("table", { name: "Opportunity map zones" });
    await expect(
      table.getByRole("row", { name: /Not on the map/ }),
    ).toContainText("2");
    const box = await table.locator("..").boundingBox();
    expect(box && box.width <= 1 && box.height <= 1).toBe(true);
  });

  test("the hidden table lists every zone", async ({ page }) => {
    await page.goto(MAP_URL);
    const table = page.getByRole("table", { name: "Opportunity map zones" });
    await expect(table.getByRole("columnheader")).toHaveText([
      "Zone",
      "Rule",
      "Keywords",
    ]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toContainText("Quick wins");
    await expect(rows.nth(0)).toContainText(
      "Popularity 20 or more and difficulty 25 or less",
    );
    await expect(rows.nth(0)).toContainText("8");
  });

  test("a click on an empty zone presses it", async ({ page }) => {
    const clickEmptyQuickWins = async () => {
      const zone = page.locator(".zone-quickWins").first();
      await zone.scrollIntoViewIfNeeded();
      const box = await zone.boundingBox();
      if (!box) throw new Error("no quick wins area");
      await page.mouse.click(
        box.x + box.width * 0.2,
        box.y + box.height * 0.125,
      );
    };
    await page.goto(MAP_URL);

    await clickEmptyQuickWins();
    await expect(page).toHaveURL(/zone=quickWins/);
    await expect(
      page.getByRole("list", { name: "Active filters" }),
    ).toBeVisible();
    await clickEmptyQuickWins();
    await expect(page).not.toHaveURL(/zone=/);
  });

  test("a click on a dot never presses the zone", async ({ page }) => {
    await page.goto(MAP_URL);
    await page
      .locator('[data-map-keyword="kw-map-1"] circle')
      .first()
      .click({ force: true });
    await expect(page).not.toHaveURL(/zone=/);
  });

  test("an area moves with its threshold", async ({ page }) => {
    await storeThresholds(page, '{"popularity":20,"difficulty":20}');
    await page.goto(MAP_URL);
    const plot = await page
      .locator(".recharts-cartesian-grid")
      .first()
      .boundingBox();
    const area = await page.locator(".zone-quickWins").first().boundingBox();
    if (!plot || !area) throw new Error("no plot");
    expect(Math.abs(area.width - plot.width * 0.2)).toBeLessThan(2);
  });

  test("threshold labels stay inside the plot at the edges", async ({
    page,
  }) => {
    await storeThresholds(page, '{"popularity":100,"difficulty":100}');
    await page.goto(MAP_URL);
    const plot = await page
      .locator(".recharts-cartesian-grid")
      .first()
      .boundingBox();
    if (!plot) throw new Error("no plot");

    for (const text of ["Popularity 100", "Difficulty 100"]) {
      const label = await chartSvg(page)
        .locator("text", { hasText: text })
        .boundingBox();
      if (!label) throw new Error(`no label ${text}`);
      expect(label.x).toBeGreaterThanOrEqual(plot.x);
      expect(label.y).toBeGreaterThanOrEqual(plot.y);
      expect(label.x + label.width).toBeLessThanOrEqual(plot.x + plot.width);
      expect(label.y + label.height).toBeLessThanOrEqual(plot.y + plot.height);
    }
  });

  test("the thresholds popover redraws the map and persists", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    const popularity = dialog.getByRole("spinbutton", {
      name: "Popularity at least",
    });
    const difficulty = dialog.getByRole("spinbutton", {
      name: "Difficulty at most",
    });
    await expect(popularity).toHaveValue("20");
    await expect(difficulty).toHaveValue("25");

    await popularity.fill("30");
    await expect(chartSvg(page)).toContainText("Popularity 30");
    await expectToggles(page, [6, 7, 6, 4]);

    await page.reload();
    await expectToggles(page, [6, 7, 6, 4]);
    expect(page.url()).not.toMatch(/popularity|difficulty|threshold/i);
  });

  test("the other threshold", async ({ page }) => {
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    await dialog
      .getByRole("spinbutton", { name: "Difficulty at most" })
      .fill("20");
    await expectToggles(page, [5, 10, 3, 5]);
  });

  for (const input of ["150", "-1", "abc", "2.5", ""]) {
    test(`an invalid threshold ${JSON.stringify(input)} waits`, async ({
      page,
    }) => {
      await page.goto(MAP_URL);
      const dialog = await openThresholds(page);
      const field = dialog.getByRole("spinbutton", {
        name: "Popularity at least",
      });

      await field.fill(/^[-0-9.]*$/.test(input) ? input : "");
      await field.pressSequentially(/^[-0-9.]*$/.test(input) ? "" : input);

      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(dialog.getByRole("alert")).toHaveText(
        "Enter a whole number from 0 to 100",
      );
      await expectToggles(page, [8, 7, 4, 4]);

      await dialog
        .getByRole("spinbutton", { name: "Difficulty at most" })
        .focus();
      await expect(field).toHaveValue("20");
      await expect(field).not.toHaveAttribute("aria-invalid");
    });
  }

  test("reset", async ({ page }) => {
    await storeThresholds(page, '{"popularity":30,"difficulty":40}');
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    const reset = dialog.getByRole("button", { name: "Reset" });

    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(
      dialog.getByRole("spinbutton", { name: "Popularity at least" }),
    ).toHaveValue("20");
    await expectToggles(page, [8, 7, 4, 4]);
    await expect(reset).toHaveAttribute("aria-disabled", "true");
    await expect(reset).not.toHaveAttribute("disabled");
    await expect(reset).toBeFocused();

    await page.keyboard.press("Enter");
    await expectToggles(page, [8, 7, 4, 4]);
    await expect(reset).toBeFocused();
  });

  test("a click on reset lands while an invalid value shows", async ({
    page,
  }) => {
    await storeThresholds(page, '{"popularity":30,"difficulty":25}');
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    await dialog
      .getByRole("spinbutton", { name: "Popularity at least" })
      .fill("150");
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.getByRole("button", { name: "Reset" }).click();

    await expectToggles(page, [8, 7, 4, 4]);
  });

  test("a click on reset lands when the popover opens upward", async ({
    page,
  }) => {
    await storeThresholds(page, '{"popularity":30,"difficulty":25}');
    await page.goto(MAP_URL);
    const trigger = page.getByRole("button", { name: "Thresholds" });
    await trigger.evaluate((node) => node.scrollIntoView({ block: "end" }));
    const dialog = await openThresholds(page);
    const opened = await dialog.boundingBox();
    const anchor = await trigger.boundingBox();
    expect(opened && anchor && opened.y < anchor.y).toBe(true);
    await dialog
      .getByRole("spinbutton", { name: "Popularity at least" })
      .fill("150");
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.getByRole("button", { name: "Reset" }).click();

    await expectToggles(page, [8, 7, 4, 4]);
  });

  test("closing returns focus to the trigger", async ({ page }) => {
    await page.goto(MAP_URL);
    await openThresholds(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Zone thresholds" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Thresholds" }),
    ).toBeFocused();
  });

  test("thresholds are not in the link", async ({ page, browser }) => {
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    await dialog
      .getByRole("spinbutton", { name: "Popularity at least" })
      .fill("30");
    await expectToggles(page, [6, 7, 6, 4]);
    await page.keyboard.press("Escape");
    await toggle(page, "Quick wins").click();
    await expect(page).toHaveURL(/zone=quickWins/);
    expect(page.url()).not.toMatch(/popularity|difficulty|threshold/i);

    const fresh = await browser.newContext();
    await fresh.addCookies(await page.context().cookies());
    const other = await fresh.newPage();
    await other.goto(page.url());
    await expectToggles(other, [8, 7, 4, 4]);
    await fresh.close();
  });

  test("blocked storage still applies thresholds for the session", async ({
    page,
  }) => {
    await blockStorage(page);
    await page.goto(MAP_URL);
    const dialog = await openThresholds(page);
    await dialog
      .getByRole("spinbutton", { name: "Popularity at least" })
      .fill("30");
    await expectToggles(page, [6, 7, 6, 4]);
  });

  test("zone InfoTips", async ({ page }) => {
    await page.goto(MAP_URL);
    for (const name of [
      "Quick wins",
      "Worth fighting for",
      "Easy pickings",
      "Low priority",
    ]) {
      const about = legend(page).getByRole("button", { name: `About ${name}` });
      await about.focus();
      await page.keyboard.press("Enter");
      const tip = page.getByRole("dialog", { name });
      await expect(tip).toBeVisible();
      const link = tip.getByRole("link", { name: "Read the opportunity map" });
      await expect(link).toHaveAttribute(
        "href",
        "https://docs.asobeast.com/guides/track-keywords#read-the-opportunity-map",
      );
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noreferrer/);
      await page.keyboard.press("Escape");
      await expect(tip).toHaveCount(0);
      await expect(about).toBeFocused();
    }
    await legend(page)
      .getByRole("button", { name: "About Quick wins" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Quick wins" }),
    ).toHaveAccessibleDescription(
      /Popularity 20 or more and difficulty 25 or less/,
    );
  });

  test("the map card keeps its server rendered place at 320 px after hydration", async ({
    page,
    context,
  }) => {
    const serverRender = await context.newPage();
    await serverRender.setViewportSize({ width: 320, height: 900 });
    await serverRender.route("**/_next/static/chunks/**", (route) =>
      route.request().resourceType() === "script"
        ? route.abort()
        : route.continue(),
    );
    await serverRender.goto(MAP_URL);
    await expect(mapCard(serverRender)).toBeVisible();
    await serverRender.evaluate(() => document.fonts.ready);
    const served = await mapCard(serverRender).boundingBox();
    await serverRender.close();

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(MAP_URL);
    await hydrated(page.getByRole("button", { name: "Columns" }));
    await expect(dots(page).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const settled = await mapCard(page).boundingBox();

    expect(served).not.toBeNull();
    expect(settled?.y).toBe(served?.y);
  });

  test("the legend fits at 320 px", async ({ page }) => {
    const narrow = { width: 320, height: 900 };
    await page.setViewportSize(narrow);
    await page.goto(MAP_URL);
    const items = legend(page).getByRole("listitem");
    await expect(items).toHaveCount(4);
    const boxes = await items.evaluateAll((elements) =>
      elements.map((element) => {
        const { y, left, right } = element.getBoundingClientRect();
        return { y, left, right };
      }),
    );
    const [first, second, third, fourth] = boxes;
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
    expect(Math.abs(third.y - fourth.y)).toBeLessThan(2);
    expect(third.y).toBeGreaterThan(first.y);
    for (const { left, right } of boxes) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(narrow.width);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

const dot = (page: Page, id: string) =>
  page.locator(`[data-map-keyword="${id}"]`);
const dotTarget = (page: Page, id: string) =>
  dot(page, id).locator("circle").first();
const overlay = (page: Page) => page.locator('[data-slot="map-overlay"]');
const activeDot = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.getAttribute("data-map-keyword") ?? null,
  );

test.describe("dots", () => {
  test("a dot is named in words", async ({ page }) => {
    await page.goto(MAP_URL);
    await expect(
      page.getByRole("button", {
        name: "focus timer, position 3, popularity 62, difficulty 18, opportunity 82, Quick wins",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(dot(page, "kw-map-3")).toHaveAccessibleName(
      /^study timer, not in the top 200, /,
    );
    await expect(dot(page, "kw-map-8")).toHaveAccessibleName(
      /popularity 41, floor answer/,
    );
    await expect(dot(page, "kw-map-7")).toHaveAccessibleName(/, paused$/);
  });

  test("hover shows the overlay", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").hover();

    const shown = overlay(page);
    await expect(shown).toBeVisible();
    await expect(shown).toHaveAttribute("aria-hidden", "true");
    for (const text of [
      "focus timer",
      /Position\s*3/,
      /Popularity\s*62/,
      /Difficulty\s*18/,
      /Opportunity\s*82/,
      "Quick wins",
    ]) {
      await expect(shown).toContainText(text);
    }
    const region = await mapRegion(page).boundingBox();
    const box = await shown.boundingBox();
    expect(
      region &&
        box &&
        box.x >= region.x - 1 &&
        box.x + box.width <= region.x + region.width + 1,
    ).toBe(true);

    await page.mouse.move(0, 0);
    await expect(shown).toHaveCount(0);
  });

  test("the overlay says what a floor answer is", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-8").hover();
    await expect(overlay(page)).toContainText("Floor answer");
    await dot(page, "kw-map-2").hover();
    await expect(overlay(page)).not.toContainText("Floor answer");
    await dot(page, "kw-map-3").hover();
    await expect(overlay(page)).toContainText("Not in the top 200");
  });

  test("the overlay stays inside the chart", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-10").hover();
    const region = await mapRegion(page).boundingBox();
    const box = await overlay(page).boundingBox();
    const target = await dot(page, "kw-map-10").boundingBox();
    if (!region || !box || !target) throw new Error("no boxes");

    expect(box.x + box.width).toBeLessThanOrEqual(target.x + target.width / 2);
    expect(box.y).toBeGreaterThanOrEqual(target.y + target.height / 2);
    expect(box.x).toBeGreaterThanOrEqual(region.x);
    expect(box.y + box.height).toBeLessThanOrEqual(region.y + region.height);
  });

  for (const width of [1280, 375, 320]) {
    test(`no overlay leaves the chart at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(MAP_URL);
      await expect(dots(page)).toHaveCount(23);
      const named = await dots(page).evaluateAll((nodes) =>
        nodes.map((node) => ({
          id: node.getAttribute("data-map-keyword") ?? "",
          text: (node.getAttribute("aria-label") ?? "").split(",")[0],
        })),
      );
      for (const { id, text } of named) {
        await dot(page, id).focus();
        await expect(overlay(page).locator("p").first()).toHaveText(text);
        const box = await overlay(page).boundingBox();
        const region = await mapRegion(page).boundingBox();
        if (!box || !region) throw new Error(`no overlay for ${id}`);
        expect(box.y, id).toBeGreaterThanOrEqual(region.y);
        expect(box.y + box.height, id).toBeLessThanOrEqual(
          region.y + region.height,
        );
        expect(box.x, id).toBeGreaterThanOrEqual(region.x);
        expect(box.x + box.width, id).toBeLessThanOrEqual(
          region.x + region.width,
        );
      }
    });
  }

  test("focus shows it too", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    await expect(overlay(page)).toContainText("focus timer");
    await dot(page, "kw-map-1").blur();
    await expect(overlay(page)).toHaveCount(0);
  });

  test("one tab stop", async ({ page }) => {
    await page.goto(MAP_URL);
    await expect(page.locator('[data-map-keyword][tabindex="0"]')).toHaveCount(
      1,
    );
    await expect(dot(page, "kw-map-3")).toHaveAttribute("tabindex", "0");

    await legend(page)
      .getByRole("button", { name: "About Low priority" })
      .focus();
    await page.keyboard.press("Tab");
    expect(await activeDot(page)).toBe("kw-map-3");

    await page.keyboard.press("Tab");
    expect(await activeDot(page)).toBeNull();

    await page.keyboard.press("Shift+Tab");
    expect(await activeDot(page)).toBe("kw-map-3");
  });

  test("roving focus", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-6").focus();
    await page.keyboard.press("ArrowRight");
    expect(await activeDot(page)).toBe("kw-map-13");
    await expect(page.locator('[data-map-keyword][tabindex="0"]')).toHaveCount(
      1,
    );
    await expect(dot(page, "kw-map-13")).toHaveAttribute("tabindex", "0");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await activeDot(page)).toBe("kw-map-13");
  });

  test("arrows go to the nearest dot", async ({ page }) => {
    await page.goto(MAP_URL);
    const from = async (id: string, key: string) => {
      await dot(page, id).focus();
      await page.keyboard.press(key);
      return activeDot(page);
    };

    expect(await from("kw-map-6", "ArrowRight")).toBe("kw-map-13");
    expect(await from("kw-map-6", "ArrowLeft")).toBe("kw-map-1");
    expect(await from("kw-map-6", "ArrowUp")).toBe("kw-map-1");
    expect(await from("kw-map-6", "ArrowDown")).toBe("kw-map-2");
    expect(await from("kw-map-19", "ArrowLeft")).toBe("kw-map-19");
    expect(await from("kw-map-6", "Home")).toBe("kw-map-3");
    expect(await from("kw-map-6", "End")).toBe("kw-map-21");
  });

  test("the keys do not scroll or step Recharts", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.goto(MAP_URL);
    await dot(page, "kw-map-6").focus();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await expect(page.locator(".recharts-tooltip-wrapper")).toHaveCount(0);
  });

  test("focus survives a hover", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    await dot(page, "kw-map-2").hover();
    await expect(overlay(page)).toContainText("pomodoro app");
    await page.mouse.move(0, 0);
    expect(await activeDot(page)).toBe("kw-map-1");
  });

  test("Enter, Space and a click open the history beside the dot", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    const history = page.getByRole("dialog", {
      name: "Position history focus timer",
    });

    await dot(page, "kw-map-1").focus();
    await page.keyboard.press("Enter");
    await expect(history).toBeVisible();
    await expect(history.getByRole("region")).toBeVisible();
    const box = await history.boundingBox();
    const target = await dot(page, "kw-map-1").boundingBox();
    if (!box || !target) throw new Error("no boxes");
    const gap = Math.max(
      0,
      box.y - (target.y + target.height),
      target.y - (box.y + box.height),
    );
    expect(gap).toBeLessThan(400);

    await page.keyboard.press("Escape");
    await expect(history).toHaveCount(0);
    await expect(dot(page, "kw-map-1")).toBeFocused();

    await page.keyboard.press("Space");
    await expect(history).toBeVisible();
    await page.getByText("Popularity by difficulty").click();
    await expect(history).toHaveCount(0);
    await expect(dot(page, "kw-map-1")).toBeFocused();

    await dot(page, "kw-map-1").click();
    await expect(history).toBeVisible();
    await expect(page).not.toHaveURL(/zone=/);
  });

  test("a not ranking dot opens its history too", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-3").click();
    const history = page.getByRole("dialog", {
      name: "Position history study timer",
    });
    await expect(history).toBeVisible();
    await expect(history).toContainText(">200");
  });

  test("dimmed and paused dots still work", async ({ page }) => {
    await page.goto(`${MAP_URL}&zone=quickWins`);
    await dot(page, "kw-map-9").focus();
    await expect(overlay(page)).toContainText("productivity");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Position history productivity" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await dot(page, "kw-map-7").click();
    await expect(
      page.getByRole("dialog", { name: "Position history paused phrase" }),
    ).toBeVisible();
  });

  test("the dialog from a dot is named like the table row's", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    await page
      .getByRole("button", { name: "Position history: focus timer" })
      .click();
    const named = page.getByRole("dialog", {
      name: "Position history focus timer",
    });
    await expect(named).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(named).toHaveCount(0);

    await dot(page, "kw-map-1").click();
    await expect(
      page.getByRole("dialog", { name: "Position history focus timer" }),
    ).toBeVisible();
  });
});

const KEYWORDS_REFETCH = /\/api\/backend\/apps\/app-map\/keywords\?/;

async function answerRefetch(
  page: Page,
  edit: (rows: { keywordId: string; volume: number | null }[]) => unknown,
) {
  await page.route(KEYWORDS_REFETCH, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, json: edit(await response.json()) });
  });
}

test.describe("the overlay and the list it reads", () => {
  test.setTimeout(60_000);

  test("a refetch that changes a focused keyword updates its overlay", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    await expect(overlay(page)).toContainText(/Popularity\s*62/);

    await answerRefetch(page, (rows) =>
      rows.map((row) =>
        row.keywordId === "kw-map-1" ? { ...row, volume: 70 } : row,
      ),
    );

    await expect(overlay(page)).toContainText(/Popularity\s*70/, {
      timeout: 25_000,
    });
    await expect(dot(page, "kw-map-1")).toBeFocused();
  });

  test("the overlay sits beside a labelled dot, not beside its label", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    const glyph = await dotTarget(page, "kw-map-1").boundingBox();
    const box = await overlay(page).boundingBox();
    if (!glyph || !box) throw new Error("no boxes");

    expect(Math.abs(box.x - (glyph.x + glyph.width / 2 + 8))).toBeLessThan(2);
  });

  test("a focused dot shows its overlay again after another is hovered", async ({
    page,
  }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    await dotTarget(page, "kw-map-2").hover();
    await expect(overlay(page)).toContainText("pomodoro app");

    await page.mouse.move(0, 0);

    await expect(overlay(page)).toContainText("focus timer");
  });

  test("focus survives the open keyword leaving the list", async ({ page }) => {
    await page.goto(MAP_URL);
    await dot(page, "kw-map-1").focus();
    await page.keyboard.press("Enter");
    const history = page.getByRole("dialog", {
      name: "Position history focus timer",
    });
    await expect(history).toBeVisible();

    await answerRefetch(page, (rows) =>
      rows.filter((row) => row.keywordId !== "kw-map-1"),
    );

    await expect(history).toHaveCount(0, { timeout: 25_000 });
    expect(await activeDot(page)).not.toBeNull();
  });
});

test("another tab's thresholds replace this tab's unsaved ones", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.goto(MAP_URL);
  const dialog = await openThresholds(page);
  await dialog
    .getByRole("spinbutton", { name: "Popularity at least" })
    .fill("30");
  await expectToggles(page, [6, 7, 6, 4]);

  const other = await context.newPage();
  await other.goto(MAP_URL);
  const otherDialog = await openThresholds(other);
  await otherDialog
    .getByRole("spinbutton", { name: "Popularity at least" })
    .fill("40");
  await expectToggles(other, [4, 6, 8, 5]);

  await expectToggles(page, [4, 6, 8, 5]);
});
