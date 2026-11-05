import type { BrowserContext, Page } from "@playwright/test";
import {
  ALERT_EVENT_PAGE_SIZE,
  ALERT_EVENTS_COOKIE,
  ALERT_EVENT_ITEMS,
  LONG_ALERT_KEYWORD,
} from "./alert-feed-fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const FEED_PATH = "/api/backend/alerts/events";

const isFeedRead = (url: URL) => url.pathname === FEED_PATH;

const feedState = (context: BrowserContext, value: string) =>
  context.addCookies([
    { name: ALERT_EVENTS_COOKIE, value, url: "http://localhost:3000" },
  ]);

const rows = (page: Page) => page.getByRole("main").getByRole("listitem");

const dayHeadings = (page: Page) =>
  page.getByRole("main").getByRole("heading", { level: 2 });

test.describe("alerts page", () => {
  test("lists the events grouped by UTC day, newest first", async ({
    page,
  }) => {
    await page.goto("/alerts");

    await expect(
      page.getByRole("heading", { level: 1, name: "Alerts" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
    await expect(dayHeadings(page)).toHaveCount(4);
    await expect(dayHeadings(page).first()).toHaveText(/^Today · \d+$/);
    await expect(dayHeadings(page).nth(1)).toHaveText(/^Yesterday · \d+$/);

    const first = rows(page).first();
    await expect(first).toContainText(ALERT_EVENT_ITEMS[0].sentence);
    await expect(first.locator("time")).toHaveAttribute(
      "datetime",
      ALERT_EVENT_ITEMS[0].occurredAt,
    );
    await expect(first.locator(".sr-only")).toHaveText("Metadata changed: ");
  });

  test("splits the events just before and after midnight UTC", async ({
    page,
  }) => {
    await page.goto("/alerts");

    const sectionOf = (text: string) =>
      page
        .getByRole("region")
        .filter({ has: page.getByRole("listitem").filter({ hasText: text }) });

    await expect(
      sectionOf(LONG_ALERT_KEYWORD).getByRole("heading"),
    ).not.toHaveText(
      await sectionOf('"timer" in GB').getByRole("heading").innerText(),
    );
  });

  test("links each event to the place it happened", async ({ page }) => {
    await page.goto("/alerts");

    await expect(
      page.getByRole("link", { name: /climbed from #20 to #7/ }),
    ).toHaveAttribute(
      "href",
      "/apps/app-1/keywords?country=de&q=%22pomodoro%22",
    );
    await expect(page.getByRole("link", { name: /"timer" in GB/ })).toHaveCount(
      0,
    );
    await expect(rows(page).filter({ hasText: '"timer" in GB' })).toHaveCount(
      1,
    );

    await (
      await hydrated(
        page.getByRole("link", { name: /entered the Productivity free chart/ }),
      )
    ).click();

    await expect(page).toHaveURL(/\/charts\?.*view=table/);
  });

  test("loads the next page once and hands focus to the end of the list", async ({
    page,
  }) => {
    const cursors: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (isFeedRead(url) && url.searchParams.has("cursor")) {
        cursors.push(url.searchParams.get("cursor") ?? "");
      }
    });
    await page.goto("/alerts");
    const loadMore = await hydrated(
      page.getByRole("button", { name: "Load more" }),
    );

    await loadMore.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    await expect(rows(page)).toHaveCount(ALERT_EVENT_ITEMS.length);
    await expect(page.locator('[data-slot="feed-end"]')).toBeFocused();
    await expect(page.locator('[data-slot="feed-end"]')).toHaveText(
      "That is every event of the last 30 days.",
    );
    expect(cursors).toEqual([`c${ALERT_EVENT_PAGE_SIZE}`]);
  });

  test("says nothing was recorded yet on an empty feed", async ({
    page,
    context,
  }) => {
    await feedState(context, "empty");
    await page.goto("/alerts");

    await expect(page.getByText("Nothing recorded yet")).toBeVisible();
    await expect(
      page.getByText(/The daily run records what it detects here/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Settings" }),
    ).toHaveAttribute("href", "/settings");
  });

  test("shows the segment error and recovers on try again", async ({
    page,
    context,
  }) => {
    await feedState(context, "error");
    await page.goto("/alerts");
    const boundary = page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: "Alerts could not be loaded" });
    await expect(boundary).toBeVisible({ timeout: 20_000 });

    await context.clearCookies({ name: ALERT_EVENTS_COOKIE });
    const refetched = page.waitForRequest((request) =>
      isFeedRead(new URL(request.url())),
    );
    await (
      await hydrated(boundary.getByRole("button", { name: "Try again" }))
    ).click();
    await refetched;

    await expect(boundary).toBeHidden();
    await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
  });

  test("shows the skeleton while the feed loads", async ({ page, context }) => {
    await feedState(context, "slow");
    await page.goto("/alerts", { waitUntil: "commit" });

    await expect(
      page.getByRole("status", { name: "Loading alerts" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
  });

  for (const width of [320, 375]) {
    test(`fits the page at ${width} px and lets store text pick its direction`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/alerts");
      await expect(rows(page).first()).toBeVisible();

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const arabic = rows(page).filter({ hasText: "التطبيق" });
      await expect(arabic.locator('[dir="auto"]')).toHaveCount(1);
    });
  }
});
