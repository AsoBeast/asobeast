import { expect, test } from "./session.mts";
import type { Page } from "@playwright/test";
import { ACTIONS, PORTFOLIO, RECENT_CHANGES } from "./fixtures.mts";
import { hoverForTooltip } from "./hover.mts";
import { PORTFOLIO_INSIGHTS } from "./portfolio-insights.mts";

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
  await expect(card).toContainText("No keyword moved this week.");
  await expect(card.getByRole("list")).toHaveCount(0);
});

for (const { cookie, sentence } of [
  {
    cookie: "portfolio_insights_unranked",
    sentence: "No keyword moved this week.",
  },
  {
    cookie: "portfolio_insights_fresh",
    sentence: "Movement appears after a week of daily runs.",
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
    .filter({ hasText: "Focus Timer" })
    .filter({ hasText: `${versions.length} version updates` });
  await expect(run).toHaveCount(1);
  await expect(run).toContainText(`latest ${versions[0].after}`);
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

test("listing changes group today's events under a day heading", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    changesCard(page).getByRole("heading", { name: "Today", level: 3 }),
  ).toBeVisible();
});
