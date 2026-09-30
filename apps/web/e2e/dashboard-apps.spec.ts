import type { Page } from "@playwright/test";
import type { PortfolioSummary } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";
import { hydrated } from "./hydrated.mts";

const appsRegion = (page: Page) => page.getByRole("region", { name: "Apps" });

const cardNames = (page: Page) =>
  appsRegion(page)
    .locator('[data-slot="app-grid"] > li')
    .evaluateAll((items) =>
      items.map(
        (item) => item.querySelector("span[title]")?.textContent?.trim() ?? "",
      ),
    );

const withManyApps = (page: Page) =>
  page
    .context()
    .addCookies([
      { name: "portfolio_many", value: "1", url: "http://localhost:3000" },
    ]);

const card = (page: Page, name: string) =>
  appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(name, { exact: true }) });

test("a captured app card shows its bands, audit and open actions", async ({
  page,
}) => {
  await page.goto("/");

  const tomato = card(page, "Tomato Clock");
  await expect(tomato.getByText("2 in top 10")).toBeVisible();
  await expect(
    tomato.getByRole("img", { name: /^Rank bands: 0 at #1, 1 at #2–3/ }),
  ).toBeVisible();
  await expect(tomato).toContainText("Audit");
  await expect(tomato).toContainText("Audit 55, fair");
  await expect(
    tomato.getByRole("link", { name: /1 open action\b/ }),
  ).toHaveAttribute("href", "/apps/app-gp/actions");
});

test("a card counts one competitor in the singular", async ({ page }) => {
  await page.goto("/");

  const tomato = card(page, "Tomato Clock");
  await expect(tomato.getByText("3 keywords", { exact: true })).toBeVisible();
  await expect(tomato.getByText("1 competitor", { exact: true })).toBeVisible();

  const timer = card(page, "Focus Timer");
  await expect(timer.getByText("5 keywords", { exact: true })).toBeVisible();
  await expect(timer.getByText("1 competitor", { exact: true })).toBeVisible();

  const habit = card(page, "Habit Tracker");
  await expect(habit.getByText("0 competitors", { exact: true })).toBeVisible();
});

test("a storefront member shows its rating and open actions", async ({
  page,
}) => {
  await page.goto("/");

  const member = appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ hasText: "Storefronts" })
    .getByRole("listitem")
    .filter({ has: page.getByText("US", { exact: true }) });
  await expect(member).toContainText("Rating 4.6, strong");
  await expect(
    member.getByRole("link", { name: /5 open actions/ }),
  ).toHaveAttribute("href", "/apps/app-1/actions");
  await expect(
    member.getByRole("link", { name: /2 new low ratings/ }),
  ).toHaveCount(0);
});

test("a sparse app card leaves out what it does not have", async ({ page }) => {
  await page.goto("/");

  const habit = card(page, "Habit Tracker");
  await expect(habit).toContainText("Rating 4.1, fair");
  await expect(habit.getByRole("img", { name: /^Rank bands/ })).toHaveCount(0);
  await expect(habit).not.toContainText("Audit");
  await expect(habit.getByRole("link", { name: /open action/ })).toHaveCount(0);
  await expect(habit.getByText("0", { exact: true })).toHaveCount(0);
});

test("a pending app card still only says it is waiting", async ({ page }) => {
  await page.goto("/");

  const pending = card(page, "Pending App");
  await expect(pending.getByText(/Awaiting the first daily run/)).toBeVisible();
  await expect(pending.getByRole("img")).toHaveCount(0);
  await expect(pending).not.toContainText("Rating");
  await expect(pending.getByText("0", { exact: true })).toHaveCount(0);
});

test("app card footers line up along a grid row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const footers = page.locator('[data-slot="app-card-footer"]');
  await expect(footers.first()).toBeVisible();
  const boxes = await footers.evaluateAll((nodes) =>
    nodes.map((node) => {
      const card = node.closest("li")!.getBoundingClientRect();
      return { top: card.top, bottom: node.getBoundingClientRect().bottom };
    }),
  );
  const firstRow = boxes.filter((box) => Math.abs(box.top - boxes[0].top) <= 1);

  expect(firstRow.length).toBeGreaterThan(1);
  for (const box of firstRow) {
    expect(Math.abs(box.bottom - firstRow[0].bottom)).toBeLessThanOrEqual(1);
  }
});

test("sorting the app list by name writes the url", async ({ page }) => {
  await page.goto("/");

  const sortBy = appsRegion(page).getByRole("combobox", { name: "Sort by" });
  await (await hydrated(sortBy)).click();
  await page.getByRole("option", { name: "Name" }).click();

  await expect(page).toHaveURL(/[?&]sort=name/);
  await expect.poll(async () => (await cardNames(page))[0]).toBe("Focus Timer");
  const names = await cardNames(page);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test("the app list restores its sort from the url", async ({ page }) => {
  await page.goto("/?sort=rating");

  await expect(
    appsRegion(page).getByRole("combobox", { name: "Sort by" }),
  ).toHaveText("Rating");
  await expect.poll(async () => (await cardNames(page))[0]).toBe("Focus Timer");
  const names = await cardNames(page);
  expect(names.indexOf("Habit Tracker")).toBeLessThan(
    names.indexOf("Tomato Clock"),
  );
});

test("searching the app list filters cards and writes the url", async ({
  page,
}) => {
  await withManyApps(page);
  await page.goto("/");

  const search = appsRegion(page).getByRole("textbox", { name: "Search apps" });
  await expect(search).toBeVisible();
  const everything = (await cardNames(page)).length;
  await search.fill("tomato");

  await expect(page).toHaveURL(/[?&]q=tomato/);
  await expect.poll(() => cardNames(page)).toEqual(["Tomato Clock"]);

  await search.fill("");

  await expect
    .poll(async () => (await cardNames(page)).length)
    .toBe(everything);
});

test("a short app list offers no search", async ({ page }) => {
  await page.goto("/");

  await expect(
    appsRegion(page).getByRole("combobox", { name: "Sort by" }),
  ).toBeVisible();
  await expect(
    appsRegion(page).getByRole("textbox", { name: "Search apps" }),
  ).toHaveCount(0);
});

test("a search without matches offers to clear it", async ({ page }) => {
  await withManyApps(page);
  await page.goto("/?q=zzz");

  const region = appsRegion(page);
  await expect(region.getByText('No apps match "zzz"')).toBeVisible();

  await region.getByRole("button", { name: "Clear filters" }).click();

  await expect
    .poll(async () => (await cardNames(page)).length)
    .toBeGreaterThan(6);
  await expect(page).not.toHaveURL(/[?&]q=/);
});

test("the table view lists every app as its own row", async ({ page }) => {
  await page.goto("/");

  const tableTab = appsRegion(page).getByRole("tab", { name: "Table" });
  await (await hydrated(tableTab)).click();

  await expect(page).toHaveURL(/[?&]view=table/);
  const table = appsRegion(page).getByRole("table", {
    name: "Apps in this workspace",
  });
  await expect(table).toBeVisible();
  const { apps } = (await page.request
    .get("/api/backend/portfolio")
    .then((response) => response.json())) as PortfolioSummary;
  await expect(table.locator("tbody tr")).toHaveCount(apps.length);
  await expect(
    table.getByRole("link", { name: "Tomato Clock" }),
  ).toHaveAttribute("href", "/apps/app-gp");
});

test("a table header sort is the same sort the cards use", async ({ page }) => {
  await page.goto("/?view=table");

  await appsRegion(page)
    .getByRole("table")
    .getByRole("button", { name: "Rating" })
    .click();

  await expect(page).toHaveURL(/[?&]sort=rating/);
  await expect(
    appsRegion(page).getByRole("columnheader", { name: /Rating/ }),
  ).toHaveAttribute("aria-sort", "descending");

  await appsRegion(page).getByRole("tab", { name: "Cards" }).click();

  await expect(
    appsRegion(page).getByRole("combobox", { name: "Sort by" }),
  ).toHaveText("Rating");
});

test("the table keeps phone columns and reveals more on request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?view=table");

  const headers = appsRegion(page).getByRole("columnheader");
  await expect(headers).toHaveText(["App", "Visibility", "7d", "Open actions"]);

  await appsRegion(page).getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Rating" }).click();
  await page.keyboard.press("Escape");

  await expect(
    appsRegion(page).getByRole("columnheader", { name: /Rating/ }),
  ).toBeVisible();
});

test("hovering the rank bands of a card shows the breakdown", async ({
  page,
}) => {
  await page.goto("/");

  const bands = card(page, "Tomato Clock").getByRole("img", {
    name: /^Rank bands/,
  });
  await hoverForTooltip(
    page,
    bands,
    page.getByRole("tooltip").getByText("#11–50"),
  );
});

test("a search from the address stays visible on a short app list", async ({
  page,
}) => {
  await page.goto("/?q=tomato");

  const search = appsRegion(page).getByRole("textbox", { name: "Search apps" });
  await expect(search).toHaveValue("tomato");
  await expect.poll(() => cardNames(page)).toEqual(["Tomato Clock"]);

  await search.fill("");

  await expect
    .poll(async () => (await cardNames(page)).length)
    .toBeGreaterThan(1);
});

test("the table sorts an app awaiting its first run last", async ({ page }) => {
  await page.goto("/?view=table&sort=top10&dir=asc");

  const names = appsRegion(page)
    .getByRole("table")
    .locator("tbody tr td:first-child a");
  await expect(names.first()).toBeVisible();
  const order = await names.allInnerTexts();
  expect(order.indexOf("Pending App")).toBeGreaterThan(
    order.indexOf("Tomato Clock"),
  );
});

test("the phone table truncates a long app name", async ({ page }) => {
  await withManyApps(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?view=table");

  const header = appsRegion(page).getByRole("columnheader").first();
  await expect(header).toHaveText("App");
  const width = await header.evaluate(
    (node) => node.getBoundingClientRect().width,
  );

  expect(width).toBeLessThanOrEqual(200);
});
