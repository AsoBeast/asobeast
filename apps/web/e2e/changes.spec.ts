import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_1_CHANGE_IMPACT,
  APP_GP_CHANGE_IMPACT,
  PLAY_CHANGE_IMPACT_COOKIE,
} from "./fixtures.mts";
import {
  CHANGES_STATE_COOKIE,
  LONG_TITLE,
  RTL_SUBTITLE,
} from "./changes-fixtures.mts";
import { formatDate, formatDayMonth } from "../src/lib/format";

const [RECENT, MEASURED, OLDER, UNANCHORED] = APP_1_CHANGE_IMPACT.items;

const impactCard = (page: Page) =>
  page.getByRole("region", { name: "How rankings moved after each change" });

const changeRow = (page: Page, changedOn: string) =>
  impactCard(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", { level: 3, name: formatDate(changedOn) }),
    });

const windowTile = (page: Page, changedOn: string, days: number) =>
  changeRow(page, changedOn)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", { level: 4, name: `After ${days} days` }),
    });

const timeline = (page: Page) =>
  page.getByRole("region", { name: /^Listing changes/ });

test("a timeline row shows the icon its change carries", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  const row = timeline(page).locator('[data-change-field="title"]').first();
  await expect(row.locator("img")).toHaveJSProperty("naturalWidth", 1);
  await expect(
    timeline(page).locator('[data-change-field="description"] img'),
  ).toHaveCount(0);
});

test("what's new notes read as lines, exactly as stored, in the timeline", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const notes = timeline(page).getByText(/^v2\.8/);
  await expect(notes).toBeVisible();
  expect(await notes.innerText()).toBe(
    "v2.8\n- New stickers\n- Type <Username> to mention\n- Faster sync &amp; backup",
  );
});

test("a what's new change names the field as its heading does", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  await expect(timeline(page)).toContainText("What's new updated:");
  await expect(timeline(page)).not.toContainText("What’s New");
});

test("the impact card lists every change newest first above the timeline", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const card = impactCard(page);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText(
    APP_1_CHANGE_IMPACT.items.map((item) => formatDate(item.changedOn)),
  );
  await expect(card).toContainText(
    "4 changes to your listing in the last 90 days",
  );
  const recent = changeRow(page, RECENT.changedOn);
  await expect(recent.getByText("Title", { exact: true })).toBeVisible();
  await expect(recent.getByText("Description", { exact: true })).toBeVisible();

  const cardBox = await card.boundingBox();
  const timelineBox = await timeline(page).boundingBox();
  expect(cardBox?.y).toBeLessThan(timelineBox?.y ?? 0);
});

test("pending windows say when they become measurable", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  for (const impact of RECENT.windows) {
    await expect(windowTile(page, RECENT.changedOn, impact.days)).toContainText(
      `Measurable on ${formatDate(impact.targetDate)}`,
    );
  }
});

test("a measured window shows the visibility and keyword movement", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const [week] = MEASURED.windows;
  const tile = windowTile(page, MEASURED.changedOn, 7);
  await expect(tile).toContainText(
    `Measured on ${formatDate(week.measuredOn)}`,
  );
  for (const text of [
    "38.4 → 42.1",
    "2 improved, 1 declined",
    "1 started ranking",
    "5 keywords checked on both days",
  ]) {
    await expect(tile).toContainText(text);
  }
  await expect(tile.getByLabel("up 3.7 in visibility")).toBeVisible();
  await expect(tile.getByLabel("up 3 positions")).toBeVisible();
});

test("a window names the later change that falls inside it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  await expect(windowTile(page, MEASURED.changedOn, 14)).toContainText(
    `Another change on ${formatDate(RECENT.changedOn)} falls inside this window.`,
  );
});

test("unmeasured windows and unanchored changes say why", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  const [, fortnight] = OLDER.windows;
  await expect(windowTile(page, OLDER.changedOn, 14)).toContainText(
    `No rank check near ${formatDate(fortnight.targetDate)}`,
  );
  const unanchored = changeRow(page, UNANCHORED.changedOn);
  await expect(unanchored).toContainText(
    "No rank check just before this change",
  );
  await expect(unanchored.getByRole("heading", { level: 4 })).toHaveCount(1);
  await expect(windowTile(page, UNANCHORED.changedOn, 7)).toContainText(
    "Get taps300 → 270",
  );
});

test("the timeline window drives the impact report", async ({ page }) => {
  await page.goto("/apps/app-1/changes");
  await expect(
    impactCard(page).getByRole("heading", { level: 3 }).first(),
  ).toBeVisible();

  const request = page.waitForRequest((sent) => {
    const url = new URL(sent.url());
    return (
      url.pathname === "/api/backend/apps/app-1/changes/impact" &&
      url.searchParams.get("days") === "30" &&
      url.searchParams.get("country") === "us"
    );
  });
  await page.getByRole("tab", { name: "30d" }).click();
  await request;

  await expect(page).toHaveURL(/days=30/);
  await expect(impactCard(page)).toContainText("in the last 30 days");
});

test("a market without keywords explains what to track", async ({ page }) => {
  await page.goto("/apps/app-2/changes");

  await expect(impactCard(page)).toContainText(
    "No keywords tracked in United States yet",
  );
});

test("an app without changes says so for the window", async ({ page }) => {
  await page.goto("/apps/app-gp/changes");

  await expect(impactCard(page)).toContainText(
    "No changes to your listing in the last 90 days",
  );
});

test("a second market can be picked and is kept in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const market = page.getByRole("combobox", { name: "Market", exact: true });
  await expect(market).toHaveText("US · United States");
  await market.click();
  await page.getByRole("option", { name: "PL · Poland" }).click();

  await expect(page).toHaveURL(/country=pl/);
  await expect(impactCard(page)).toContainText(
    "No keywords tracked in Poland yet",
  );
});

test("a market deep link opens on it and the home market clears the key", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?country=pl");

  const market = page.getByRole("combobox", { name: "Market", exact: true });
  await expect(market).toHaveText("PL · Poland");
  await expect(impactCard(page)).toContainText(
    "No keywords tracked in Poland yet",
  );

  await market.click();
  await page.getByRole("option", { name: "US · United States" }).click();

  await expect(page).not.toHaveURL(/country=/);
  await expect(
    impactCard(page).getByRole("heading", { level: 3 }).first(),
  ).toBeVisible();
});

test("a single market app has no picker and measures its home market", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/changes");
  await expect(impactCard(page)).toContainText("No changes to your listing");
  await expect(page.getByRole("combobox", { name: "Market" })).toHaveCount(0);

  const request = page.waitForRequest((sent) => {
    const url = new URL(sent.url());
    return (
      url.pathname === "/api/backend/apps/app-gp/changes/impact" &&
      url.searchParams.get("country") === "de"
    );
  });
  await page.getByRole("tab", { name: "30d" }).click();
  await request;
});

test("a measured window reads Get taps and conversion from the console", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const tile = windowTile(page, OLDER.changedOn, 7);
  await expect(tile).toContainText("Get taps412 → 486");
  await expect(tile).toContainText("Conversion3.1% → 3.6%");
  await expect(tile.getByLabel("up 18% in Get taps")).toHaveText("18%");
});

test("a google play window names acquisitions, not Get taps", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: PLAY_CHANGE_IMPACT_COOKIE,
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-gp/changes");

  const tile = windowTile(page, APP_GP_CHANGE_IMPACT.items[0].changedOn, 7);
  await expect(tile).toContainText("Acquisitions35 → 70");
  await expect(tile).not.toContainText("Get taps");
  await expect(tile.getByLabel("up 100% in Acquisitions")).toHaveText("100%");
});

test("a window still filling says when the console's numbers are final", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  await expect(windowTile(page, MEASURED.changedOn, 14)).toContainText(
    "The console's numbers for this window are final in 5 days",
  );
  await expect(windowTile(page, OLDER.changedOn, 28)).toContainText(
    "No console data before this change",
  );
});

test("the timeline marks the conversion change beside the day of a change", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?days=90");

  await expect(
    timeline(page).getByRole("heading", { level: 2, name: /Conversion \+16%/ }),
  ).toContainText(formatDate(OLDER.changedOn));
  await expect(
    timeline(page).getByRole("heading", { level: 2, name: /Conversion -11%/ }),
  ).toContainText(formatDate(UNANCHORED.changedOn));
  await expect(
    timeline(page).getByRole("heading", { level: 2, name: /Conversion/ }),
  ).toHaveCount(2);
});

test("the timeline of a market listing shows no home conversion beside its days", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?days=90&market=pl");

  await expect(timeline(page)).toBeVisible();
  await expect(
    timeline(page).getByRole("heading", { level: 2, name: /Conversion/ }),
  ).toHaveCount(0);
});

test("an app without a console connection shows no store funnel", async ({
  page,
}) => {
  await page.goto("/apps/app-2/changes");

  await expect(page.getByText("Store funnel")).toHaveCount(0);
  await expect(page.getByText(/Conversion [+-]/)).toHaveCount(0);
});

const activity = (page: Page) =>
  page.getByRole("region", { name: "Visibility and listing changes" });

const breakdown = (page: Page) =>
  page.getByRole("region", { name: "What changed" });

const changeState = (page: Page, state: string) =>
  page.context().addCookies([
    {
      name: CHANGES_STATE_COOKIE,
      value: state,
      domain: "localhost",
      path: "/",
    },
  ]);

test("the page opens with the newest change and the last measured effect", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const lede = page.getByText(/^On .* you changed the/);
  await expect(lede).toContainText(
    `On ${formatDayMonth(RECENT.changedOn)}, you changed the title and description.`,
  );
  await expect(lede).toContainText(
    `Your icon change of ${formatDayMonth(MEASURED.changedOn)} was followed by visibility up 3.7 after 7 days.`,
  );
});

test("the activity panel gives each app a lane and a mark opens its day", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?owner=competitors&field=price");
  await expect(timeline(page).locator("[data-change-field]")).toHaveCount(1);

  const mark = activity(page).getByRole("button", {
    name: `${formatDayMonth(MEASURED.changedOn)}: you changed the icon`,
  });
  await expect(mark).toBeVisible();
  await expect(
    activity(page).getByRole("button", { name: /Rival Focus changed the/ }),
  ).toHaveCount(2);
  await mark.focus();
  await page.keyboard.press("Enter");

  await expect(page).not.toHaveURL(/owner=|field=/);
  const day = timeline(page).getByRole("heading", {
    level: 2,
    name: new RegExp(formatDate(MEASURED.changedOn)),
  });
  await expect(day).toBeFocused();
  await expect(day).toBeInViewport();
});

test("the owner switch counts and filters the timeline", async ({ page }) => {
  await page.goto("/apps/app-1/changes");

  const rows = timeline(page).locator("[data-change-field]");
  await expect(rows).toHaveCount(11);
  await expect(page.getByRole("tab", { name: "Competitors 4" })).toBeVisible();
  await page.getByRole("tab", { name: "Competitors 4" }).click();

  await expect(page).toHaveURL(/owner=competitors/);
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: "Focus Timer" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Competitors 4" })).toBeFocused();
});

test("a row of what changed filters the timeline and clearing it keeps focus", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const screenshots = breakdown(page).getByRole("button", {
    name: "Screenshots: 3 yours, 2 from competitors",
  });
  await screenshots.click();

  await expect(page).toHaveURL(/field=screenshots/);
  await expect(screenshots).toHaveAttribute("aria-pressed", "true");
  await expect(timeline(page).locator("[data-change-field]")).toHaveCount(5);
  await expect(timeline(page)).toContainText("Screenshots only");

  await timeline(page).getByRole("button", { name: "Clear filter" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).not.toHaveURL(/field=/);
  await expect(timeline(page).locator("[data-change-field]")).toHaveCount(11);
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(false);
});

test("a day you changed the listing links its measured effect", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");

  const effect = timeline(page).getByRole("link", {
    name: /Visibility up 3\.7 points after 7 days/,
  });
  await expect(effect).toBeVisible();
  await effect.click();

  await expect(page).toHaveURL(/#change-impact-/);
  await expect(
    impactCard(page).getByRole("heading", {
      level: 3,
      name: formatDate(MEASURED.changedOn),
    }),
  ).toBeInViewport();
});

test("a competitor's versions fold into a row that opens and yours stay on their days", async ({
  page,
}) => {
  await changeState(page, "busy");
  await page.goto("/apps/app-1/changes");

  const versions = timeline(page).locator('[data-change-field="version"]');
  await expect(versions).toHaveCount(4);
  await expect(versions.filter({ hasText: "Focus Timer" })).toHaveCount(3);
  const run = versions.filter({ hasText: "3 versions" });
  await expect(run).toContainText("Deep Work Clock");
  await expect(run).toContainText("latest 1.3");
  await expect(run).not.toContainText("1.0");

  await run.getByRole("button", { name: "Show versions" }).click();

  await expect(run).toContainText("1.0");
  await expect(
    run.getByRole("button", { name: "Hide versions" }),
  ).toBeFocused();
});

test("a mark of a version folded into a newer row opens the day that shows it", async ({
  page,
}) => {
  await changeState(page, "busy");
  await page.goto("/apps/app-1/changes");

  const marks = activity(page).getByRole("button", {
    name: /Deep Work Clock changed the version$/,
  });
  await expect(marks).toHaveCount(3);
  await marks.first().focus();
  await page.keyboard.press("Enter");

  const run = timeline(page)
    .locator("section")
    .filter({ hasText: "3 versions" });
  await expect(run.getByRole("heading", { level: 2 })).toBeFocused();
});

test("a long title and a right to left subtitle stay inside the page", async ({
  page,
}) => {
  await changeState(page, "busy");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/apps/app-1/changes");

  await expect(timeline(page)).toContainText(LONG_TITLE);
  await expect(timeline(page)).toContainText(RTL_SUBTITLE);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("a window with only competitor changes has no owner switch", async ({
  page,
}) => {
  await changeState(page, "competitors");
  await page.goto("/apps/app-1/changes");

  await expect(timeline(page).locator("[data-change-field]")).toHaveCount(4);
  await expect(
    page.getByRole("tablist", { name: "Changes shown" }),
  ).toHaveCount(0);
  await expect(activity(page).getByText("You", { exact: true })).toHaveCount(0);
});

test("a google play timeline names the short description", async ({ page }) => {
  await changeState(page, "play");
  await page.goto("/apps/app-gp/changes");

  await expect(
    timeline(page).locator('[data-change-field="summary"]'),
  ).toContainText("Short description");
  await expect(timeline(page)).not.toContainText("Subtitle");
});

test("an app without changes offers the widest window", async ({ page }) => {
  await page.goto("/apps/app-2/changes");

  await expect(activity(page)).toHaveCount(0);
  await expect(breakdown(page)).toHaveCount(0);
  await timeline(page).getByRole("button", { name: "Show 365 days" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/days=365/);
  await expect(timeline(page)).toContainText("No changes in the last 365 days");
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(false);
});

test("a market without keywords reads no effect in the opening sentence", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes?country=pl");

  const lede = page.getByText(/^On .* you changed the/);
  await expect(lede).toBeVisible();
  await expect(lede).not.toContainText("visibility");
  await expect(lede).not.toContainText("measurable");
  await expect(timeline(page).getByText(/after 7 days/)).toHaveCount(0);
});
