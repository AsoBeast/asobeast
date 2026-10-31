import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { missingDescriptionIds } from "./described-by.mts";
import { pressFromKeyboard } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import {
  SERP_HISTORY_DAYS,
  SERP_PLAY_AVERAGE,
  SERP_TRACKABLE,
} from "./serp-history.mts";
import { expect, test } from "./session.mts";
import {
  answerTrack,
  SERP_TRACK_PATH,
  showTrackedAfterAdd,
} from "./serp-track.mts";

const SERP_PATH = "/api/backend/keywords/kw-1/serp";

const isSerpRead = (url: URL) => url.pathname === SERP_PATH;

const serpSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Search results" });

const failureIn = (page: Page) =>
  serpSheet(page)
    .getByRole("alert")
    .filter({ hasText: "The search results could not be loaded." });

const formatDayMonth = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const listUnder = (sheet: Locator, heading: string) =>
  sheet.getByRole("region", { name: heading, exact: true }).getByRole("list");

const rowAt = (sheet: Locator, position: number) =>
  sheet.locator(`li#serp-row-${position}`);

async function failSerpReads(page: Page): Promise<() => void> {
  let failing = true;
  await page.route(isSerpRead, (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  return () => {
    failing = false;
  };
}

async function openSerp(page: Page, text = "focus timer"): Promise<void> {
  const opener = page.getByRole("button", {
    name: `View search results for ${text}`,
    exact: true,
  });
  await (await hydrated(opener)).click();
}

async function openStudyTimer(page: Page): Promise<Locator> {
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  const sheet = serpSheet(page);
  await expect(rowAt(sheet, 1)).toBeVisible();
  return sheet;
}

test("opens from the row with the keyword large in the sheet", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await openSerp(page);

  await expect(page).toHaveURL(/serp=kw-1/);
  await expect(serpSheet(page)).toContainText("focus timer");
  await expect(serpSheet(page)).toContainText("United States, App Store");
});

test("exporting downloads the snapshot the sheet shows", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await openSerp(page);
  const sheet = serpSheet(page);
  await expect(sheet.getByText("Rival Focus")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet
      .getByRole("button", { name: "Export CSV of the search results" })
      .click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^serp-app-1-kw-1-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const lines = readFileSync(await download.path(), "utf8").split("\r\n");
  expect(lines[0]).toBe(
    "﻿keyword,capturedOn,position,app,developer,rating,ratings,role,storeAppId,previousPosition",
  );
  expect(lines).toHaveLength(6);
  expect(lines[3]).toMatch(
    /^focus timer,\d{4}-\d{2}-\d{2},3,Focus Timer,Focus Labs,4\.8,24000,you,123456789,$/,
  );
  expect(lines[4]).toMatch(
    /,4,Rival Focus,Rival Labs,4\.5,12000,competitor,comp-store,$/,
  );
  expect(lines[5]).toMatch(/,5,Newcomer Timer,,,,other,stranger-store,$/);
});

test("exports every position of a deep day with its earlier position", async ({
  page,
}) => {
  const sheet = await openStudyTimer(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet
      .getByRole("button", { name: "Export CSV of the search results" })
      .click(),
  ]);

  const lines = readFileSync(await download.path(), "utf8").split("\r\n");
  expect(lines).toHaveLength(51);
  expect(lines[2]).toMatch(/,2,Study Timer & Focus,.*,4$/);
  expect(lines[3]).toMatch(/,3,Study Timer Plus,.*,$/);
});

test("a read that fails stays inside the sheet and retry loads it", async ({
  page,
}) => {
  const recover = await failSerpReads(page);
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await openSerp(page);

  await expect(failureIn(page)).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/serp=kw-1/);
  await expect(page.getByText("Keywords could not be loaded")).toHaveCount(0);
  await expect(
    page
      .getByRole("row", { includeHidden: true })
      .filter({ hasText: "focus timer" }),
  ).toBeVisible();

  recover();
  const reads: string[] = [];
  page.on("request", (request) => {
    if (isSerpRead(new URL(request.url()))) reads.push(request.url());
  });
  await serpSheet(page).getByRole("button", { name: "Retry" }).click();

  await expect(serpSheet(page).getByText("Rival Focus")).toBeVisible();
  await expect(failureIn(page)).toHaveCount(0);
  await expect(page).toHaveURL(/serp=kw-1/);
  await expect(page.getByText("Keywords could not be loaded")).toHaveCount(0);
  expect(reads).toHaveLength(1);
});

test("a read that failed loads when the sheet is opened again", async ({
  page,
}) => {
  const recover = await failSerpReads(page);
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");
  await openSerp(page);
  await expect(failureIn(page)).toBeVisible({ timeout: 20_000 });

  recover();
  await page.keyboard.press("Escape");
  await expect(serpSheet(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/serp=/);
  await openSerp(page);

  await expect(serpSheet(page).getByText("Rival Focus")).toBeVisible();
  await expect(failureIn(page)).toHaveCount(0);
});

test("the sheet is described only by elements it renders", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");
  await openSerp(page);

  await expect(serpSheet(page)).toHaveAccessibleDescription(
    "The apps the store showed for this keyword on a daily check.",
  );
  expect(await missingDescriptionIds(serpSheet(page))).toEqual([]);
});

test("splits the top 50 into the top 10 and the positions below", async ({
  page,
}) => {
  const sheet = await openStudyTimer(page);

  await expect(
    sheet.getByRole("heading", { name: "Top 10", exact: true }),
  ).toBeVisible();
  await expect(listUnder(sheet, "Top 10").getByRole("listitem")).toHaveCount(
    10,
  );
  const deeper = listUnder(sheet, "Positions 11 to 50");
  await expect(deeper).toHaveAttribute("start", "11");
  await expect(deeper.getByRole("listitem")).toHaveCount(40);
});

test("shows an icon on every row and the placeholder where there is none", async ({
  page,
}) => {
  const sheet = await openStudyTimer(page);
  const lists = sheet.getByRole("region", { name: /^(Top 10|Positions)/ });

  await expect(lists.locator("img")).toHaveCount(49);
  await expect(lists.locator('[data-slot="app-icon-placeholder"]')).toHaveCount(
    1,
  );
});

test("marks your row and jumps to it from the summary", async ({ page }) => {
  const sheet = await openStudyTimer(page);
  const yours = rowAt(sheet, 7);

  await expect(yours).toContainText("You");
  const jump = sheet.getByRole("button", {
    name: "Jump to your row at #7",
    exact: true,
  });
  await jump.click();

  await expect(yours).toBeFocused();
});

test("says how each row moved since the earlier capture", async ({ page }) => {
  const sheet = await openStudyTimer(page);

  await expect(rowAt(sheet, 2)).toContainText("Up 2 from #4");
  await expect(rowAt(sheet, 3)).toContainText("New entry");
  await expect(rowAt(sheet, 30)).toContainText("No earlier position");
  await expect(sheet).toContainText(
    `vs ${formatDayMonth(SERP_HISTORY_DAYS[1])}`,
  );
});

test("lists the apps that left since the earlier capture", async ({ page }) => {
  const sheet = await openStudyTimer(page);
  const left = sheet.getByRole("region", {
    name: `Left since ${formatDayMonth(SERP_HISTORY_DAYS[1])}`,
  });

  await expect(left).toContainText("was 6");
  await expect(left).toContainText("Old Study Timer");
  await expect(left.getByRole("button")).toHaveCount(0);
});

test("marks the keyword's words in a title", async ({ page }) => {
  const sheet = await openStudyTimer(page);

  await expect(rowAt(sheet, 1).locator("mark")).toHaveText(["Study", "Timer"]);
  await expect(rowAt(sheet, 15).locator("mark").first()).toContainText(
    "accents differ",
  );
  await expect(rowAt(sheet, 10).locator("mark")).toHaveCount(0);
});

test("lays out a right to left title from the right edge of its row", async ({
  page,
}) => {
  const sheet = await openStudyTimer(page);
  const title = rowAt(sheet, 20).locator('[translate="no"]').first();
  const column = rowAt(sheet, 20).locator('[translate="no"]').last();

  const [titleBox, columnBox] = await Promise.all([
    title.boundingBox(),
    column.boundingBox(),
  ]);

  expect(titleBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  expect(
    Math.abs(
      (titleBox?.x ?? 0) +
        (titleBox?.width ?? 0) -
        ((columnBox?.x ?? 0) + (columnBox?.width ?? 0)),
    ),
  ).toBeLessThan(1);
});

test("sums up titles and ratings of the top 10", async ({ page }) => {
  const sheet = await openStudyTimer(page);

  const summary = sheet.locator("dl");
  await expect(summary.getByText("7 of 10")).toBeVisible();
  await expect(summary.getByText("7K", { exact: true })).toBeVisible();
  await expect(summary.getByText("median", { exact: true })).toBeVisible();
});

test("shows the average rating of a store that reports no counts", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/keywords?serp=kw-gp-1");
  const sheet = serpSheet(page);

  const summary = sheet.locator("dl");
  await expect(
    summary.getByText(SERP_PLAY_AVERAGE.toFixed(1), { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText("average", { exact: true })).toBeVisible();
  await expect(sheet).toContainText("Germany, Google Play");
});

test("names a checked position deeper than the list", async ({ page }) => {
  await page.goto("/apps/app-1/keywords?serp=kw-5");
  const sheet = serpSheet(page);
  await expect(sheet.getByText("below the top 30")).toBeVisible();
  await expect(sheet.getByText("#45", { exact: true })).toBeVisible();
});

test("says a checked keyword was not found within its depth", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?serp=kw-4");

  await expect(serpSheet(page).getByText("Not in the top 200")).toBeVisible();
});

test("says a keyword was never checked and exports nothing", async ({
  page,
}) => {
  await page.goto("/apps/app-unchecked/keywords?serp=kw-unchecked-1");
  const sheet = serpSheet(page);

  await expect(
    sheet.getByText(
      "Not checked yet. The search results appear after the next daily check.",
    ),
  ).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Export CSV of the search results" }),
  ).toBeDisabled();
});

for (const width of [320, 375]) {
  test(`fits a ${width} px screen without sideways scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const sheet = await openStudyTimer(page);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  });
}

test.describe("captured day", () => {
  const [TODAY, YESTERDAY, DAY_BEFORE] = SERP_HISTORY_DAYS;
  const dayReads = (page: Page) => {
    const days: (string | null)[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/backend/keywords/kw-3/serp") {
        days.push(url.searchParams.get("date"));
      }
    });
    return days;
  };

  test("steps back through the captured days and forward to the newest", async ({
    page,
  }) => {
    const sheet = await openStudyTimer(page);
    const reads = dayReads(page);
    const previous = sheet.getByRole("button", {
      name: "Previous captured day",
    });
    const next = sheet.getByRole("button", { name: "Next captured day" });

    await expect(
      sheet.getByRole("button", { name: /^Captured day/ }),
    ).toHaveAccessibleName(`Captured day, ${formatDay(TODAY)}`);
    await pressFromKeyboard(previous);
    await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));
    await expect(sheet).toContainText(`vs ${formatDayMonth(DAY_BEFORE)}`);
    await expect(rowAt(sheet, 3)).not.toContainText("New entry");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`serpDate=${DAY_BEFORE}`));
    await expect(
      sheet.getByText("Positions below the top 10 are not kept for this day."),
    ).toBeVisible();
    await expect(
      sheet.getByRole("heading", { name: /^Positions 11/ }),
    ).toHaveCount(0);
    await expect(sheet).toContainText("No earlier capture");
    await expect(previous).toBeFocused();
    await expect(previous).toHaveAttribute("aria-disabled", "true");

    await pressFromKeyboard(next);
    await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/serpDate=/);
    await expect(rowAt(sheet, 3)).toContainText("New entry");
    expect(reads.filter((day) => day === YESTERDAY)).toHaveLength(1);
    expect(reads.filter((day) => day === DAY_BEFORE)).toHaveLength(1);
  });

  test("picks a captured day from the popover with the keyboard", async ({
    page,
  }) => {
    const sheet = await openStudyTimer(page);
    const trigger = sheet.getByRole("button", { name: /^Captured day/ });

    await pressFromKeyboard(trigger);
    const grid = page.getByRole("dialog", { name: "Choose captured day" });
    if (DAY_BEFORE.slice(0, 7) !== TODAY.slice(0, 7)) {
      await grid.getByRole("button", { name: "Previous month" }).click();
    }
    await grid
      .getByRole("button", { name: formatDay(DAY_BEFORE), exact: true })
      .press("Enter");

    await expect(page).toHaveURL(new RegExp(`serpDate=${DAY_BEFORE}`));
    await expect(trigger).toBeFocused();
  });

  test("says a linked day was not captured and keeps the picker", async ({
    page,
  }) => {
    const missing = "2020-01-15";
    await page.goto(`/apps/app-1/keywords?serp=kw-3&serpDate=${missing}`);
    const sheet = serpSheet(page);

    await expect(
      sheet.getByText(
        `Nothing was captured on ${formatDay(missing)}. Pick a captured day.`,
      ),
    ).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "Next captured day" }),
    ).toBeVisible();
  });

  test("closing clears the keyword and the day from the url", async ({
    page,
  }) => {
    await page.goto(`/apps/app-1/keywords?serp=kw-3&serpDate=${YESTERDAY}`);
    await expect(rowAt(serpSheet(page), 1)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(serpSheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/serp=|serpDate=/);
  });

  test("opening another keyword forgets the day", async ({ page }) => {
    await page.goto(`/apps/app-1/keywords?serp=kw-3&serpDate=${YESTERDAY}`);
    await expect(rowAt(serpSheet(page), 1)).toBeVisible();
    await page.keyboard.press("Escape");

    await openSerp(page);

    await expect(page).toHaveURL(/serp=kw-1/);
    await expect(page).not.toHaveURL(/serpDate=/);
    await expect(serpSheet(page).getByText("Rival Focus")).toBeVisible();
  });
});

test.describe("row actions", () => {
  const track = (sheet: Locator) =>
    sheet.getByRole("button", {
      name: `Track ${SERP_TRACKABLE.title} at #${SERP_TRACKABLE.position}`,
      exact: true,
    });

  test("opens a row in the store of the keyword's country", async ({
    page,
  }) => {
    const sheet = await openStudyTimer(page);
    const link = sheet.getByRole("link", {
      name: "Open Study Timer Pro in the store",
      exact: true,
    });

    await expect(link).toHaveAttribute(
      "href",
      "https://apps.apple.com/us/app/id777000001",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noreferrer/);
  });

  test("offers Track only on rows that are neither yours nor a competitor", async ({
    page,
  }) => {
    const sheet = await openStudyTimer(page);

    await expect(
      rowAt(sheet, 7).getByRole("button", { name: /^Track/ }),
    ).toHaveCount(0);
    await expect(
      rowAt(sheet, 4).getByRole("button", { name: /^Track/ }),
    ).toHaveCount(0);
    await expect(track(sheet)).toBeVisible();
  });

  test("tracks a row from the keyboard and hands focus to its store link", async ({
    page,
  }) => {
    const bodies: unknown[] = [];
    await page.route(SERP_TRACK_PATH, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      bodies.push(route.request().postDataJSON());
      return answerTrack(route);
    });
    await showTrackedAfterAdd(page);
    const sheet = await openStudyTimer(page);

    await pressFromKeyboard(track(sheet));

    await expect(
      page.getByText(`Now tracking ${SERP_TRACKABLE.title}`),
    ).toBeVisible();
    const row = rowAt(sheet, SERP_TRACKABLE.position);
    await expect(row).toContainText("Competitor");
    await expect(
      row.getByRole("link", {
        name: `Open ${SERP_TRACKABLE.title} in the store`,
      }),
    ).toBeFocused();
    expect(bodies).toEqual([{ url: SERP_TRACKABLE.storeAppId }]);
  });

  test("a refused Track says why and keeps its button focused", async ({
    page,
  }) => {
    const message = "You have used every competitor add your plan allows.";
    await page.route(SERP_TRACK_PATH, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 429,
            json: {
              statusCode: 429,
              message,
              error: "Too Many Requests",
              path: "/apps/app-1/competitors",
              timestamp: new Date().toISOString(),
            },
          })
        : route.fallback(),
    );
    const sheet = await openStudyTimer(page);

    await pressFromKeyboard(track(sheet));

    await expect(page.getByText(message)).toBeVisible();
    await expect(track(sheet)).toBeFocused();
  });

  test("opens a google play row with the storefront country", async ({
    page,
  }) => {
    await page.goto("/apps/app-gp/keywords?serp=kw-gp-1");

    await expect(
      serpSheet(page).getByRole("link", {
        name: "Open Pomodoro Timer 1 in the store",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.example.pomodoro1&gl=de",
    );
  });
});

for (const theme of THEMES) {
  test(`the open sheet has no contrast violation in the ${theme} theme`, async ({
    page,
  }) => {
    expect(
      await contrastViolations(page, theme, "/apps/app-1/keywords?serp=kw-3"),
    ).toEqual([]);
  });
}
