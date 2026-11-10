import { expect, test } from "./session.mts";
import type { Page } from "@playwright/test";
import {
  ALERT_EVENT_ITEMS,
  ALERT_EVENTS_COOKIE,
} from "./alert-feed-fixtures.mts";
import { ACTIONS, PORTFOLIO, RECENT_CHANGES } from "./fixtures.mts";
import { hoverForTooltip } from "./hover.mts";
import { hydrated } from "./hydrated.mts";
import { PORTFOLIO_INSIGHTS } from "./portfolio-insights.mts";
import { seedCookies } from "./routes.mts";

const DASHBOARD_ACTION_LIMIT = 5;

const moversCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Keyword movers", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const VISIBLE_CHANGES = 8;

const changesCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Listing changes", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const changeRows = (page: Page) =>
  changesCard(page).getByRole("listitem").getByRole("link");

const dayMonth = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const dayLabel = (timestamp: string) => dayMonth.format(new Date(timestamp));

const RECENT_ALERTS = 5;
const ALERT_WINDOW_DAYS = 7;
const ALERT_FEED_PATH = "/api/backend/alerts/events";

const alertsCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Alerts", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const alertRows = (page: Page) => alertsCard(page).getByRole("listitem");

const appName = (appId: string) =>
  PORTFOLIO.apps.find((app) => app.id === appId)?.name ?? "";

test("do next names the app and opens the exact action", async ({ page }) => {
  await page.goto("/");

  const card = page
    .getByRole("heading", { name: "Do next", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  const rows = card.getByRole("listitem");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(DASHBOARD_ACTION_LIMIT);

  const [first] = ACTIONS;
  const link = rows.first().getByRole("link");
  await expect(link).toContainText('Add "habit tracker" to your metadata');
  await expect(link).toContainText(first.scope.appName ?? "");
  await expect(link).toContainText(first.scope.country.toUpperCase());
  await expect(link).toHaveAttribute("href", `/actions?action=${first.id}`);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/actions\\?action=${first.id}$`));
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText('Add "habit tracker" to your metadata');
});

const moverRows = (page: Page) =>
  moversCard(page).getByRole("list").getByRole("listitem");

const ALL_MOVERS = [
  ...PORTFOLIO_INSIGHTS.movers.up,
  ...PORTFOLIO_INSIGHTS.movers.down,
];

test("keyword movers list every move with its app and market", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const card = moversCard(page);
  await expect(
    card.getByRole("tab", { name: "All", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(card.getByRole("list")).toHaveCount(1);
  const rows = moverRows(page);
  await expect(rows).toHaveCount(ALL_MOVERS.length);
  for (const mover of ALL_MOVERS) {
    const row = rows.filter({
      has: page.getByText(mover.text, { exact: true }),
    });
    await expect(row).toContainText(appName(mover.appId));
    await expect(row).toContainText(mover.country.toUpperCase());
  }
});

test("keyword movers lead with arrivals and exits, then the largest moves", async ({
  page,
}) => {
  await page.goto("/");

  const rows = moverRows(page);
  await expect(rows.first()).toContainText("new");
  await expect(rows.nth(1)).toContainText("lost");
  await expect(
    rows.nth(2).getByText("focus timer", { exact: true }),
  ).toBeVisible();
  await expect(rows.last()).toContainText("pomodoro");
});

test("keyword movers filter climbers and fallers", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const card = moversCard(page);
  const [faller] = PORTFOLIO_INSIGHTS.movers.down;
  const fallerRow = card.getByText(faller.text).filter({ visible: true });
  await expect(fallerRow).toHaveCount(1);

  await card.getByRole("tab", { name: "Climbers" }).click();
  await expect(page).toHaveURL(/[?&]movers=up/);
  await expect(fallerRow).toHaveCount(0);
  await expect(moverRows(page)).toHaveCount(
    PORTFOLIO_INSIGHTS.movers.up.length,
  );

  await card.getByRole("tab", { name: "Fallers" }).click();
  await expect(page).toHaveURL(/[?&]movers=down/);
  await expect(fallerRow).toHaveCount(1);
  await expect(moverRows(page)).toHaveCount(
    PORTFOLIO_INSIGHTS.movers.down.length,
  );
});

test("the movers filter survives a reload", async ({ page }) => {
  await page.goto("/?movers=down");

  const card = moversCard(page);
  await expect(card.getByRole("tab", { name: "Fallers" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(moverRows(page)).toHaveCount(
    PORTFOLIO_INSIGHTS.movers.down.length,
  );
});

test("a keyword mover opens that keyword on its app's rankings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const [climber] = PORTFOLIO_INSIGHTS.movers.up;
  await expect(
    moverRows(page)
      .filter({ has: page.getByText(climber.text, { exact: true }) })
      .getByRole("link"),
  ).toHaveAttribute(
    "href",
    `/apps/${climber.appId}/rankings?keywords=${climber.keywordId}`,
  );
});

test("keyword movers say so in a quiet week", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "portfolio_insights_quiet",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  const card = moversCard(page);
  await expect(card).toContainText("No keyword moved in the last 30 days.");
  await expect(card.getByRole("list")).toHaveCount(0);
});

for (const { cookie, sentence } of [
  {
    cookie: "portfolio_insights_unranked",
    sentence: "No keyword moved in the last 30 days.",
  },
  {
    cookie: "portfolio_insights_fresh",
    sentence: "Movement appears after 30 days of daily runs.",
  },
]) {
  test(`keyword movers explain an empty week for ${cookie}`, async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([{ name: cookie, value: "1", url: "http://localhost:3000" }]);
    await page.goto("/");

    await expect(moversCard(page)).toContainText(sentence);
  });
}

test("listing changes filter by owner and write the url", async ({ page }) => {
  await page.goto("/");

  const card = changesCard(page);
  for (const name of ["All", "Yours", "Competitors"]) {
    await expect(card.getByRole("tab", { name })).toBeVisible();
  }
  await expect(card.getByText("Focus Timer Pro")).toBeVisible();

  await card.getByRole("tab", { name: "Competitors" }).click();

  await expect(page).toHaveURL(/[?&]changes=competitors/);
  await expect(card.getByText("Focus Timer Pro")).toHaveCount(0);
  await expect(card.getByText("Deep focus timer")).toBeVisible();
});

test("the listing changes filter survives a reload", async ({ page }) => {
  await page.goto("/?changes=competitors");

  const card = changesCard(page);
  await expect(card.getByRole("tab", { name: "Competitors" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(card.getByText("Deep focus timer")).toBeVisible();
  await expect(card.getByText("Focus Timer Pro")).toHaveCount(0);
});

test("listing changes show eight rows and reveal the rest", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "recent_changes_varied",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  const card = changesCard(page);
  const rows = card.getByRole("link", { name: /Focus Timer|Rival Focus/ });
  await expect(rows).toHaveCount(VISIBLE_CHANGES);

  const hidden = RECENT_CHANGES.events.length - VISIBLE_CHANGES;
  await card.getByRole("button", { name: `Show ${hidden} more` }).click();

  await expect(rows).toHaveCount(RECENT_CHANGES.events.length);
});

test("showing more listing changes hands focus to the first revealed row", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "recent_changes_varied",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  const card = changesCard(page);
  const rows = card.getByRole("link", { name: /Focus Timer|Rival Focus/ });
  await expect(rows).toHaveCount(VISIBLE_CHANGES);
  const more = card.getByRole("button", { name: /^Show \d+ more$/ });
  await more.focus();
  await page.keyboard.press("Enter");

  await expect(rows).toHaveCount(RECENT_CHANGES.events.length);
  await expect(rows.nth(VISIBLE_CHANGES)).toBeFocused();
});

test("listing changes fold one app's version updates into one row", async ({
  page,
}) => {
  await page.goto("/");

  const card = changesCard(page);
  const versions = RECENT_CHANGES.events.filter(
    (event) => event.field === "version" && event.appId === "app-1",
  );
  const run = card
    .getByRole("link")
    .filter({ hasText: `Focus Timer shipped ${versions.length} versions` });
  await expect(run).toHaveCount(1);
  await expect(run).toContainText(`latest ${versions[0].after}`);
  await expect(run).toContainText(
    `${dayLabel(versions[versions.length - 1].capturedAt)} to ${dayLabel(versions[0].capturedAt)}`,
  );
  await expect(run).toHaveAttribute("href", "/apps/app-1/changes");
  await expect(
    card.getByRole("button", { name: /^Show \d+ more$/ }),
  ).toHaveCount(0);
});

test("listing changes read what's new notes as one line, exactly as stored", async ({
  page,
}) => {
  await page.goto("/");

  const card = changesCard(page);
  const notes = card.getByText(
    "v2.8 · New stickers · Type <Username> to mention · Faster sync &amp; backup",
    { exact: true },
  );
  await expect(notes).toBeVisible();
  await hoverForTooltip(
    page,
    notes,
    page.getByRole("tooltip").filter({
      hasText: "Previous: v2.7 · Calmer sounds",
    }),
  );
});

test("listing changes label each row with its day instead of grouping by day", async ({
  page,
}) => {
  await page.goto("/");

  const card = changesCard(page);
  const [today, earlier] = RECENT_CHANGES.events;
  const days = changeRows(page).locator(":scope > span:first-child");
  await expect(days.first()).toHaveText("Today");
  await expect(days.nth(1)).toHaveText(dayLabel(earlier.capturedAt));
  await expect(changeRows(page).first()).toHaveAttribute(
    "href",
    `/apps/${today.appId}/changes`,
  );
  await expect(card.getByRole("heading", { level: 3 })).toHaveCount(0);
  await expect(card.getByRole("list")).toHaveCount(1);
});

test("a listing change names a competitor in the row and marks whose it is", async ({
  page,
}) => {
  await page.goto("/");

  const [own, rival] = RECENT_CHANGES.events;
  const ownRow = changeRows(page).first();
  await expect(ownRow).toContainText("Title · ");
  await expect(ownRow.locator(".sr-only")).toHaveText(`${own.appName}: `);
  await expect(ownRow.locator("bdi")).toHaveCount(0);
  await expect(ownRow.locator('[data-slot="badge"]')).toHaveText("yours");

  const rivalRow = changeRows(page).nth(1);
  await expect(rivalRow).toContainText("Subtitle · ");
  await expect(rivalRow.locator("bdi")).toHaveText(rival.appName ?? "");
  await expect(rivalRow.locator("bdi")).toBeVisible();
  await expect(rivalRow.locator(".sr-only")).toHaveCount(0);
  await expect(rivalRow.locator('[data-slot="badge"]')).toHaveText(
    "competitor",
  );
});

test("the alerts panel lists the newest events of the last 7 days", async ({
  page,
}) => {
  const reads: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === ALERT_FEED_PATH && url.searchParams.has("since")) {
      reads.push(url);
    }
  });
  await page.goto("/");

  const card = alertsCard(page);
  await expect(card.getByText("Last 7 days", { exact: true })).toBeVisible();
  const rows = alertRows(page);
  await expect(rows).toHaveCount(RECENT_ALERTS);
  const newest = ALERT_EVENT_ITEMS.slice(0, RECENT_ALERTS);
  for (const [index, event] of newest.entries()) {
    await expect(rows.nth(index)).toContainText(event.sentence);
  }
  await expect(
    rows.first().locator(":scope > * > span:first-child"),
  ).toHaveText("Today");
  await expect(rows.locator('[data-slot="badge"]')).toHaveText([
    "listing",
    "fell",
    "climbed",
    "climbed",
    "milestone",
  ]);
  await expect(rows.first().locator(".sr-only")).toHaveText(
    "Metadata changed: ",
  );

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (ALERT_WINDOW_DAYS - 1));
  expect(reads).toHaveLength(1);
  expect(reads[0].searchParams.get("since")).toBe(
    since.toISOString().slice(0, 10),
  );
  expect(reads[0].searchParams.get("limit")).toBe(String(RECENT_ALERTS));
});

test("an alert opens the place it happened", async ({ page }) => {
  await page.goto("/");

  const alert = alertsCard(page).getByRole("link", {
    name: /climbed from #20 to #7/,
  });
  await expect(alert).toHaveAttribute(
    "href",
    "/apps/app-1/keywords?country=de&q=%22pomodoro%22",
  );

  await (await hydrated(alert)).click();

  await expect(page).toHaveURL(
    /\/apps\/app-1\/keywords\?country=de&q=%22pomodoro%22$/,
  );
});

test("the alerts panel says so when the week was quiet", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [ALERT_EVENTS_COOKIE]: "empty" });
  await page.goto("/");

  const card = alertsCard(page);
  await expect(card.getByText("No alerts in the last 7 days.")).toBeVisible();
  await expect(card.getByRole("list")).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);
});

test("the alerts panel shows a failed read in place and recovers on retry", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [ALERT_EVENTS_COOKIE]: "error" });
  await page.goto("/");

  const card = alertsCard(page);
  await expect(card.getByRole("alert")).toHaveText(
    "Alerts could not be loaded.",
  );
  await expect(
    page.getByRole("heading", { name: "Listing changes", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();

  await context.clearCookies({ name: ALERT_EVENTS_COOKIE });
  await (await hydrated(card.getByRole("button", { name: "Retry" }))).click();

  await expect(alertRows(page)).toHaveCount(RECENT_ALERTS);
  await expect(card.getByRole("alert")).toHaveCount(0);
});
