import { expect, test } from "./session.mts";
import type { Page } from "@playwright/test";
import { ACTIONS, PORTFOLIO, RECENT_CHANGES } from "./fixtures.mts";
import { PORTFOLIO_INSIGHTS } from "./portfolio-insights.mts";

const DASHBOARD_ACTION_LIMIT = 5;

const moversCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Keyword movers", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const VISIBLE_CHANGES = 8;

const changesCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Recent changes", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const appName = (appId: string) =>
  PORTFOLIO.apps.find((app) => app.id === appId)?.name ?? "";

test("top actions name their app and open the exact action", async ({
  page,
}) => {
  await page.goto("/");

  const card = page
    .getByRole("heading", { name: "Top actions", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  const rows = card.getByRole("listitem");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(DASHBOARD_ACTION_LIMIT);

  const [first] = ACTIONS;
  const link = rows.first().getByRole("link");
  await expect(link).toContainText(first.scope.appName ?? "");
  await expect(link).toContainText(first.scope.country.toUpperCase());
  await expect(link).toHaveAttribute("href", `/actions?action=${first.id}`);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/actions\\?action=${first.id}$`));
  await expect(page.locator(`#action-${first.id}`)).toHaveAttribute(
    "data-focused",
    "true",
  );
});

test("keyword movers list climbers and fallers side by side on a desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

  const card = moversCard(page);
  await expect(card.getByRole("tab")).toHaveCount(0);
  const lists = card.getByRole("list");
  await expect(lists).toHaveCount(2);

  const climbers = lists.first().getByRole("listitem");
  await expect(climbers).toHaveCount(PORTFOLIO_INSIGHTS.movers.up.length);
  for (const [index, mover] of PORTFOLIO_INSIGHTS.movers.up.entries()) {
    const row = climbers.nth(index);
    await expect(row).toContainText(mover.text);
    await expect(row).toContainText(appName(mover.appId));
    await expect(row).toContainText(mover.country.toUpperCase());
  }
  await expect(lists.last().getByRole("listitem")).toHaveCount(
    PORTFOLIO_INSIGHTS.movers.down.length,
  );

  const [first, second] = await lists.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().x),
  );
  expect(second).toBeGreaterThan(first);
});

test("keyword movers switch lists with tabs on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const card = moversCard(page);
  const [faller] = PORTFOLIO_INSIGHTS.movers.down;
  await expect(card.getByRole("tab", { name: "Climbers" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const fallerRow = card.getByText(faller.text).filter({ visible: true });
  await expect(fallerRow).toHaveCount(0);

  await card.getByRole("tab", { name: "Fallers" }).click();

  await expect(fallerRow).toHaveCount(1);
});

test("a keyword mover opens that keyword on its app's rankings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const [climber] = PORTFOLIO_INSIGHTS.movers.up;
  await expect(
    moversCard(page).getByRole("list").first().getByRole("link").first(),
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

test("recent changes filter by owner and write the url", async ({ page }) => {
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

test("the recent changes filter survives a reload", async ({ page }) => {
  await page.goto("/?changes=competitors");

  const card = changesCard(page);
  await expect(card.getByRole("tab", { name: "Competitors" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(card.getByText("Deep focus timer")).toBeVisible();
  await expect(card.getByText("Focus Timer Pro")).toHaveCount(0);
});

test("recent changes show eight events and reveal the rest", async ({
  page,
}) => {
  await page.goto("/");

  const card = changesCard(page);
  const rows = card.getByRole("link", { name: /Focus Timer|Rival Focus/ });
  await expect(rows).toHaveCount(VISIBLE_CHANGES);

  const hidden = RECENT_CHANGES.events.length - VISIBLE_CHANGES;
  await card.getByRole("button", { name: `Show ${hidden} more` }).click();

  await expect(rows).toHaveCount(RECENT_CHANGES.events.length);
});

test("recent changes group today's events under a day heading", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    changesCard(page).getByRole("heading", { name: "Today", level: 3 }),
  ).toBeVisible();
});
