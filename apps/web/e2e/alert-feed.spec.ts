import type { BrowserContext, Page } from "@playwright/test";
import {
  ALERT_EVENT_PAGE_SIZE,
  ALERT_EVENTS_COOKIE,
  ALERT_EVENT_ITEMS,
  LONG_ALERT_KEYWORD,
} from "./alert-feed-fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { revealAfterLoad } from "./late-reveal.mts";
import { collectPageErrors } from "./page-errors.mts";
import { ALERTS_SEEN_COOKIE_NAME } from "../src/lib/alerts-seen";
import { SIDEBAR_COOKIE_NAME } from "../src/lib/sidebar-cookie";
import { expect, test } from "./session.mts";

const FEED_PATH = "/api/backend/alerts/events";

const isFeedRead = (url: URL) => url.pathname === FEED_PATH;

const feedState = (context: BrowserContext, value: string) =>
  context.addCookies([
    { name: ALERT_EVENTS_COOKIE, value, url: "http://localhost:3000" },
  ]);

const rows = (page: Page) =>
  page.getByRole("main").getByRole("region").getByRole("listitem");

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

  test("shows the UTC clock time of each event under its UTC day", async ({
    page,
  }) => {
    await page.goto("/alerts");

    const late = rows(page).filter({ hasText: LONG_ALERT_KEYWORD });
    const early = rows(page).filter({ hasText: '"timer" in GB' });

    await expect(late.locator("time")).toHaveText("11:59 PM UTC");
    await expect(early.locator("time")).toHaveText("12:00 AM UTC");
    await expect(rows(page).first().locator("time")).toHaveText(
      /^\d{1,2}:\d{2} (AM|PM) UTC$/,
    );
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

    const skeleton = page
      .getByRole("status", { name: "Loading alerts" })
      .locator("[data-feed-row]")
      .first();
    await expect(skeleton).toBeVisible();
    const placeholder = await skeleton.boundingBox();
    await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
    const loaded = await rows(page).first().boundingBox();

    expect(Math.abs((loaded?.y ?? 0) - (placeholder?.y ?? 0))).toBeLessThan(3);
    expect(
      Math.abs((loaded?.height ?? 0) - (placeholder?.height ?? 0)),
    ).toBeLessThan(3);
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

  test.describe("filters", () => {
    const facet = (page: Page, name: string) =>
      page.getByRole("button", { name: new RegExp(`^Filter by ${name}`) });

    const feedRequests = (page: Page) => {
      const seen: URL[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (isFeedRead(url) && url.searchParams.get("limit") !== "1") {
          seen.push(url);
        }
      });
      return seen;
    };

    test("narrows to one app through the url and a chip", async ({ page }) => {
      const seen = feedRequests(page);
      await page.goto("/alerts");
      await (await hydrated(facet(page, "app"))).click();
      await page.getByRole("option", { name: /Focus Timer/ }).click();
      await page.keyboard.press("Escape");

      await expect(page).toHaveURL(/[?&]app=app-1/);
      await expect
        .poll(() =>
          seen.some((url) => url.searchParams.get("appId") === "app-1"),
        )
        .toBe(true);
      await expect(rows(page).filter({ hasText: "Tomato Clock" })).toHaveCount(
        0,
      );
      const chips = page.getByRole("list", { name: "Active filters" });
      await expect(chips).toContainText("App: Focus Timer");

      await chips.getByRole("button", { name: /^Remove App/ }).click();

      await expect(page).not.toHaveURL(/[?&]app=/);
      await expect(
        rows(page).filter({ hasText: "Tomato Clock" }),
      ).not.toHaveCount(0);
    });

    test("opens filtered by an app from the address without asking again", async ({
      page,
    }) => {
      const seen = feedRequests(page);
      await page.goto("/alerts?app=app-gp");
      await hydrated(facet(page, "app"));

      await expect(rows(page)).toHaveCount(
        ALERT_EVENT_ITEMS.filter(
          (item) => item.appId === "app-gp" || item.primaryAppId === "app-gp",
        ).length,
      );
      await page.waitForLoadState("networkidle");
      expect(seen).toEqual([]);
    });

    test("filters by event types and ignores an unknown one", async ({
      page,
    }) => {
      const seen = feedRequests(page);
      await page.goto("/alerts");
      await (await hydrated(facet(page, "event type"))).click();
      await page.getByRole("option", { name: /Rank dropped/ }).click();
      await page.getByRole("option", { name: /Chart entered/ }).click();
      await page.keyboard.press("Escape");

      await expect(page).toHaveURL(/type=rank\.dropped(,|%2C)chart\.entered/);
      await expect
        .poll(() =>
          seen.some(
            (url) =>
              url.searchParams.get("type") === "chart.entered,rank.dropped",
          ),
        )
        .toBe(true);
      await expect(rows(page).first()).toBeVisible();
      for (const row of await rows(page).all()) {
        await expect(row.locator(".sr-only")).toHaveText(
          /^(Rank dropped|Chart entered): $/,
        );
      }

      await facet(page, "event type").click();
      await page.getByRole("option", { name: /Rank dropped/ }).click();
      await page.getByRole("option", { name: /Chart entered/ }).click();
      await page.keyboard.press("Escape");
      await expect(page).not.toHaveURL(/type=/);

      seen.length = 0;
      await page.goto("/alerts?type=nope");
      await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
      expect(seen.some((url) => url.search.includes("nope"))).toBe(false);
    });

    test("searches the loaded events in the browser", async ({ page }) => {
      const seen = feedRequests(page);
      await page.goto("/alerts");
      const search = await hydrated(
        page.getByRole("textbox", { name: "Search alerts" }),
      );
      await page.waitForLoadState("networkidle");
      seen.length = 0;

      await search.fill("germany");

      await expect(page).toHaveURL(/q=germany/);
      await expect(rows(page).first()).toBeVisible();
      for (const row of await rows(page).all()) {
        await expect(row).toContainText("Germany");
      }
      await expect(page.getByText(/^\d+ of 50 events$/)).toBeVisible();
      await expect(
        page.getByText(
          "Searching the 50 loaded events. Load more to search further.",
        ),
      ).toBeVisible();
      expect(seen).toEqual([]);

      await search.fill("");
      await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
      await expect(search).toBeFocused();
    });

    test("clears every filter from the empty state and focuses the search", async ({
      page,
    }) => {
      await page.goto("/alerts?app=app-1&type=rank.dropped");
      const search = await hydrated(
        page.getByRole("textbox", { name: "Search alerts" }),
      );
      await search.fill("zzzz nothing matches");
      await expect(page.getByText("No events match")).toBeVisible();

      await page.getByRole("button", { name: "Clear filters" }).click();

      await expect(page).not.toHaveURL(/[?&](app|type|q)=/);
      await expect(search).toBeFocused();
      await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
    });

    test("narrows by app, type and text together and clears them all", async ({
      page,
    }) => {
      await page.goto("/alerts?app=app-1&type=rank.dropped,rank.improved");
      const search = await hydrated(
        page.getByRole("textbox", { name: "Search alerts" }),
      );
      await search.fill("pomodoro");
      await expect(page).toHaveURL(/q=pomodoro/);
      for (const row of await rows(page).all()) {
        await expect(row).toContainText("pomodoro");
      }

      await page
        .getByRole("list", { name: "Active filters" })
        .getByRole("button", { name: "Clear all" })
        .click();

      await expect(page).not.toHaveURL(/[?&](app|type|q)=/);
      await expect(search).toBeFocused();
    });

    test("keeps a search typed into a feed that streams in after the apps loaded", async ({
      page,
    }) => {
      const errors = collectPageErrors(page);
      const heldReveals = await revealAfterLoad(page);
      await page.goto("/alerts?app=app-1&type=rank.dropped,rank.improved");
      const search = await hydrated(
        page.getByRole("textbox", { name: "Search alerts" }),
      );
      await search.fill("pomodoro");

      await expect(page).toHaveURL(/q=pomodoro/);
      await expect(
        page
          .getByRole("list", { name: "Active filters" })
          .getByText("App: Focus Timer · App Store · US"),
      ).toBeVisible();
      expect(await heldReveals()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    });
  });

  test.describe("unread dot and new marks", () => {
    const NEWEST = ALERT_EVENT_ITEMS[0].occurredAt;
    const BEFORE_THREE = ALERT_EVENT_ITEMS[3].occurredAt;

    const seen = (context: BrowserContext, instant: string) =>
      context.addCookies([
        {
          name: ALERTS_SEEN_COOKIE_NAME,
          value: encodeURIComponent(instant),
          url: "http://localhost:3000",
        },
      ]);

    const alertsItem = (page: Page) =>
      page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: /^Alerts/ });

    const dot = (page: Page) => page.locator('[data-slot="alerts-unread"]');

    const newRows = (page: Page) =>
      rows(page).filter({ has: page.getByText("New", { exact: true }) });

    test("sits between the Action Center and Top charts", async ({ page }) => {
      await page.goto("/alerts");
      const names = await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link")
        .allInnerTexts();
      const position = names.findIndex((name) => name.startsWith("Alerts"));

      expect(names[position - 1]).toMatch(/^Action Center/);
      expect(names[position + 1]).toMatch(/^Top charts/);
      await expect(alertsItem(page)).toHaveAttribute("aria-current", "page");
    });

    test("shows a dot until the newest event is seen", async ({
      page,
      context,
    }) => {
      await page.goto("/");
      await expect(dot(page)).toBeVisible();
      await expect(alertsItem(page)).toHaveAccessibleName(/, new alerts$/);

      await seen(context, NEWEST);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(dot(page)).toHaveCount(0);

      await seen(context, BEFORE_THREE);
      await page.reload();
      await expect(dot(page)).toBeVisible();
    });

    test("a visit clears the dot and keeps the new marks while it lasts", async ({
      page,
      context,
    }) => {
      await seen(context, BEFORE_THREE);
      await page.goto("/");
      await expect(dot(page)).toBeVisible();

      await (await hydrated(alertsItem(page))).click();

      await expect(page).toHaveURL("/alerts");
      await expect(newRows(page)).toHaveCount(3);
      await expect(dot(page)).toHaveCount(0);
      expect(await page.evaluate(() => document.cookie)).toContain(
        `${ALERTS_SEEN_COOKIE_NAME}=${encodeURIComponent(NEWEST)}`,
      );

      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: /^Dashboard/ })
        .click();
      await expect(page).toHaveURL("/");
      await alertsItem(page).click();
      await expect(rows(page).first()).toBeVisible();
      await expect(newRows(page)).toHaveCount(0);
    });

    test("marks nothing new in a browser that never visited", async ({
      page,
    }) => {
      await page.goto("/alerts");

      await expect(rows(page)).toHaveCount(ALERT_EVENT_PAGE_SIZE);
      await expect(newRows(page)).toHaveCount(0);
    });

    test("renders the new marks in the server html and never the dot", async ({
      page,
      context,
    }) => {
      await seen(context, BEFORE_THREE);

      const alerts = await (await page.request.get("/alerts")).text();
      const home = await (await page.request.get("/")).text();

      expect(alerts.match(/>New</g)).toHaveLength(3);
      expect(alerts).not.toContain('data-slot="alerts-unread"');
      expect(home).not.toContain('data-slot="alerts-unread"');
    });

    test("keeps the dot on the icon of a collapsed sidebar", async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: SIDEBAR_COOKIE_NAME,
          value: "false",
          url: "http://localhost:3000",
        },
      ]);
      await page.goto("/");

      await expect(dot(page)).toBeVisible();
    });

    test("shows no dot and no error when the newest read fails", async ({
      page,
      context,
    }) => {
      await feedState(context, "error");
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await expect(dot(page)).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });
  });

  test.describe("controls after a clear or a failure", () => {
    test("keeps focus in the search when a clear leaves nothing recorded", async ({
      page,
      context,
    }) => {
      await feedState(context, "empty");
      await page.goto("/alerts?type=rank.dropped");
      await (
        await hydrated(page.getByRole("button", { name: "Clear filters" }))
      ).click();

      await expect(page.getByText("Nothing recorded yet")).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Search alerts" }),
      ).toBeFocused();
    });

    test("says when the next page could not be loaded and retries it", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      let failing = true;
      await page.route(
        (url) => isFeedRead(url) && url.searchParams.has("cursor"),
        (route) =>
          failing
            ? route.fulfill({ status: 500, json: { statusCode: 500 } })
            : route.fallback(),
      );
      await page.goto("/alerts");
      const loadMore = await hydrated(
        page.getByRole("button", { name: "Load more" }),
      );

      await loadMore.click();

      await expect(
        page.getByRole("alert").filter({ hasText: "could not be loaded" }),
      ).toBeVisible({ timeout: 25_000 });
      await expect(loadMore).toBeVisible();
      failing = false;
      await loadMore.click();
      await expect(rows(page)).toHaveCount(ALERT_EVENT_ITEMS.length);
    });

    test("says a search covered the loaded events only", async ({ page }) => {
      await page.goto("/alerts");
      await (
        await hydrated(page.getByRole("textbox", { name: "Search alerts" }))
      ).fill("zzzz nothing matches");

      await expect(page.getByText("No loaded events match")).toBeVisible();
      await expect(
        page.getByText(/Only the 50 loaded events were searched/),
      ).toBeVisible();
    });

    test("names the store of every app it filters by", async ({ page }) => {
      await page.goto("/alerts");
      await (
        await hydrated(page.getByRole("button", { name: /^Filter by app/ }))
      ).click();
      const labels = await page.getByRole("option").allInnerTexts();

      expect(labels.length).toBeGreaterThan(1);
      expect(new Set(labels).size).toBe(labels.length);
      for (const label of labels) {
        expect(label).toMatch(/· (App Store|Google Play) ·/);
      }
    });
  });
});
