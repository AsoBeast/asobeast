import type { Page } from "@playwright/test";
import type { PortfolioSummary } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";
import { hydrated } from "./hydrated.mts";

const appsRegion = (page: Page) =>
  page.getByRole("region", { name: "Apps", exact: true });

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

const appsTable = (page: Page) =>
  appsRegion(page).getByRole("table", { name: "Apps in this workspace" });

const tableNames = (page: Page) =>
  appsTable(page)
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector("td a")?.textContent?.trim() ?? ""),
    );

const tableRow = (page: Page, href: string) =>
  appsTable(page)
    .getByRole("row")
    .filter({ has: page.locator(`a[href="${href}"]`) });

const APP_VIEWS = [
  { view: "table", path: "/", names: tableNames },
  { view: "cards", path: "/?view=cards", names: cardNames },
] as const;

const card = (page: Page, name: string) =>
  appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(name, { exact: true }) });

test("a captured app card shows its bands, audit and open actions", async ({
  page,
}) => {
  await page.goto("/?view=cards");

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
  await page.goto("/?view=cards");

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
  await page.goto("/?view=cards");

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

test("an app card links its keyword discoveries", async ({ page }) => {
  await page.goto("/?view=cards");

  const member = appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ hasText: "Storefronts" })
    .getByRole("listitem")
    .filter({ has: page.getByText("US", { exact: true }) });
  const discoveries = member.getByRole("link", {
    name: /^11 keyword discoveries, 4 where you already rank for Focus Timer/,
  });
  await expect(discoveries).toHaveAttribute(
    "href",
    "/apps/app-1/keywords?tab=discovered",
  );
  await expect(
    card(page, "Habit Tracker").getByRole("link", {
      name: /keyword discover/,
    }),
  ).toHaveCount(0);

  await (await hydrated(discoveries)).click();

  await expect(page).toHaveURL(/\/apps\/app-1\/keywords\?tab=discovered$/);
  await expect(
    page.getByRole("heading", { name: "Discovered keywords" }),
  ).toBeVisible();
});

test("a sparse app card leaves out what it does not have", async ({ page }) => {
  await page.goto("/?view=cards");

  const habit = card(page, "Habit Tracker");
  await expect(habit).toContainText("Rating 4.1, fair");
  await expect(habit.getByRole("img", { name: /^Rank bands/ })).toHaveCount(0);
  await expect(habit).not.toContainText("Audit");
  await expect(habit.getByRole("link", { name: /open action/ })).toHaveCount(0);
  await expect(habit.getByText("0", { exact: true })).toHaveCount(0);
});

test("a pending app card still only says it is waiting", async ({ page }) => {
  await page.goto("/?view=cards");

  const pending = card(page, "Pending App");
  await expect(
    pending.getByText(/^Collecting the first positions/),
  ).toBeVisible();
  await expect(pending.getByRole("img")).toHaveCount(0);
  await expect(pending).not.toContainText("Rating");
  await expect(pending.getByText("0", { exact: true })).toHaveCount(0);
});

test("app card footers line up along a grid row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=cards");

  const footers = page.locator('[data-slot="app-card-footer"]');
  await expect(footers.first()).toBeVisible();
  const boxes = await footers.evaluateAll((nodes) =>
    nodes.map((node) => {
      const card = node.closest("li")!.getBoundingClientRect();
      return { top: card.top, bottom: node.getBoundingClientRect().bottom };
    }),
  );
  const rows = boxes
    .map((anchor) => boxes.filter((box) => Math.abs(box.top - anchor.top) <= 1))
    .filter((row) => row.length > 1);

  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    for (const box of row) {
      expect(Math.abs(box.bottom - row[0]!.bottom)).toBeLessThanOrEqual(1);
    }
  }
});

test("sorting the app list by name writes the url", async ({ page }) => {
  await page.goto("/?view=cards");

  const sortBy = appsRegion(page).getByRole("combobox", { name: "Sort by" });
  await (await hydrated(sortBy)).click();
  await page.getByRole("option", { name: "Name" }).click();

  await expect(page).toHaveURL(/[?&]sort=name/);
  await expect.poll(async () => (await cardNames(page))[0]).toBe("Focus Timer");
  const names = await cardNames(page);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test("the app list restores its sort from the url", async ({ page }) => {
  await page.goto("/?view=cards&sort=rating");

  await expect(
    appsRegion(page).getByRole("combobox", { name: "Sort by" }),
  ).toHaveText("Rating");
  await expect.poll(async () => (await cardNames(page))[0]).toBe("Focus Timer");
  const names = await cardNames(page);
  expect(names.indexOf("Habit Tracker")).toBeLessThan(
    names.indexOf("Tomato Clock"),
  );
});

for (const { view, path, names } of APP_VIEWS) {
  test(`searching the app list filters the ${view} and writes the url`, async ({
    page,
  }) => {
    await withManyApps(page);
    await page.goto(path);

    const search = appsRegion(page).getByRole("textbox", {
      name: "Search apps",
    });
    await expect(search).toBeVisible();
    const everything = (await names(page)).length;
    await search.fill("tomato");

    await expect(page).toHaveURL(/[?&]q=tomato/);
    await expect.poll(() => names(page)).toEqual(["Tomato Clock"]);

    await search.fill("");

    await expect.poll(async () => (await names(page)).length).toBe(everything);
  });

  test(`a short app list offers no search in the ${view} view`, async ({
    page,
  }) => {
    await page.goto(path);

    await expect(
      appsRegion(page).getByRole("tab", { name: "Cards" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await names(page)).length)
      .toBeGreaterThan(1);
    await expect(
      appsRegion(page).getByRole("textbox", { name: "Search apps" }),
    ).toHaveCount(0);
  });

  test(`a search without matches offers to clear it in the ${view} view`, async ({
    page,
  }) => {
    await withManyApps(page);
    await page.goto(`${path}${path.includes("?") ? "&" : "?"}q=zzz`);

    const region = appsRegion(page);
    await expect(region.getByText('No apps match "zzz"')).toBeVisible();
    await expect(region.getByRole("table")).toHaveCount(0);

    await region.getByRole("button", { name: "Clear filters" }).click();

    await expect
      .poll(async () => (await names(page)).length)
      .toBeGreaterThan(6);
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test(`a search from the address stays visible on a short app list in the ${view} view`, async ({
    page,
  }) => {
    await page.goto(`${path}${path.includes("?") ? "&" : "?"}q=tomato`);

    const search = appsRegion(page).getByRole("textbox", {
      name: "Search apps",
    });
    await expect(search).toHaveValue("tomato");
    await expect.poll(() => names(page)).toEqual(["Tomato Clock"]);

    await search.fill("");

    await expect
      .poll(async () => (await names(page)).length)
      .toBeGreaterThan(1);
  });
}

test("the table is the default view and lists every app as its own row", async ({
  page,
}) => {
  await page.goto("/");

  const region = appsRegion(page);
  await expect(region.getByRole("tab", { name: "Table" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const table = appsTable(page);
  await expect(table).toBeVisible();
  const { apps } = (await page.request
    .get("/api/backend/portfolio")
    .then((response) => response.json())) as PortfolioSummary;
  await expect(table.locator("tbody tr")).toHaveCount(apps.length);
  await expect(
    table.getByRole("link", { name: "Tomato Clock" }),
  ).toHaveAttribute("href", "/apps/app-gp");
  await expect(
    region.getByText("Trend is visibility over the last 30 days"),
  ).toBeVisible();
  await expect(region.locator('[data-slot="app-grid"]')).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]view=/);
});

test("the cards view replaces the table and writes the url", async ({
  page,
}) => {
  await page.goto("/");

  const region = appsRegion(page);
  const cardsTab = region.getByRole("tab", { name: "Cards" });
  await (await hydrated(cardsTab)).click();

  await expect(page).toHaveURL(/[?&]view=cards/);
  await expect(cardsTab).toHaveAttribute("aria-selected", "true");
  await expect(region.getByRole("table")).toHaveCount(0);
  await expect(
    region.getByText("Trend is visibility over the last 30 days"),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await cardNames(page)).length)
    .toBeGreaterThan(1);

  await region.getByRole("tab", { name: "Table" }).click();

  await expect(page).not.toHaveURL(/[?&]view=/);
  await expect(appsTable(page)).toBeVisible();
});

test("switching views from the keyboard keeps focus on the view toggle", async ({
  page,
}) => {
  await page.goto("/");

  const region = appsRegion(page);
  const tableTab = await hydrated(region.getByRole("tab", { name: "Table" }));
  const cardsTab = region.getByRole("tab", { name: "Cards" });
  await tableTab.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page).toHaveURL(/[?&]view=cards/);
  await expect(region.locator('[data-slot="app-grid"]')).toBeVisible();
  await expect(cardsTab).toBeFocused();

  await page.keyboard.press("ArrowLeft");

  await expect(page).not.toHaveURL(/[?&]view=/);
  await expect(appsTable(page)).toBeVisible();
  await expect(tableTab).toBeFocused();

  await cardsTab.click();

  await expect(region.locator('[data-slot="app-grid"]')).toBeVisible();
  await expect(cardsTab).toBeFocused();
});

test("the toolbar offers columns for the table and a sort for the cards", async ({
  page,
}) => {
  await page.goto("/");

  const region = appsRegion(page);
  const columns = region.getByRole("button", { name: "Columns" });
  const sortBy = region.getByRole("combobox", { name: "Sort by" });
  await expect(columns).toBeVisible();
  await expect(sortBy).toHaveCount(0);

  const cardsTab = region.getByRole("tab", { name: "Cards" });
  await (await hydrated(cardsTab)).click();

  await expect(sortBy).toBeVisible();
  await expect(columns).toHaveCount(0);
});

test("the 7d column shows the change alone and words a missing week for screen readers", async ({
  page,
}) => {
  await page.goto("/");

  const change = tableRow(page, "/apps/app-1").getByRole("cell", {
    name: "+5 7d",
    exact: true,
  });
  await expect(change.getByText("+5", { exact: true })).toBeVisible();
  await expect(change.locator(".sr-only")).toHaveText("7d");

  const missing = tableRow(page, "/apps/app-2").getByRole("cell", {
    name: "no 7d data",
    exact: true,
  });
  await expect(missing.locator("[aria-hidden]")).toHaveText("—");
  await expect(missing.locator(".sr-only")).toHaveText("no 7d data");
});

test("deleting an app from its table row menu removes the row", async ({
  page,
}) => {
  const deletes: string[] = [];
  await page.route("**/api/backend/portfolio", async (route) => {
    if (deletes.length === 0) return route.fallback();
    const response = await route.fetch();
    const portfolio = (await response.json()) as PortfolioSummary;
    await route.fulfill({
      response,
      json: {
        ...portfolio,
        apps: portfolio.apps.filter((app) => app.id !== "app-gp"),
      },
    });
  });
  page.on("request", (request) => {
    if (request.method() === "DELETE") {
      deletes.push(new URL(request.url()).pathname);
    }
  });
  await page.goto("/");

  const row = tableRow(page, "/apps/app-gp");
  const rows = appsTable(page).locator("tbody tr");
  await expect(row).toHaveCount(1);
  const before = await rows.count();
  await (
    await hydrated(row.getByRole("button", { name: "App actions" }))
  ).click();
  await page.getByRole("menuitem", { name: "Delete app" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("heading", { name: "Delete Tomato Clock?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Delete app" }).click();

  await expect(page.getByText("Deleted Tomato Clock")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await expect(rows).toHaveCount(before - 1);
  expect(deletes).toEqual(["/api/backend/apps/app-gp"]);
  await expect(page.locator("body")).not.toBeFocused();
  await expect(appsTable(page).locator("tbody a:focus")).toHaveCount(1);
});

test("a table header sort is the same sort the cards use", async ({ page }) => {
  await page.goto("/");

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

test("the table drops its widest columns on a tablet instead of scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  const table = appsRegion(page).getByRole("table");
  await expect(table.getByRole("columnheader", { name: "App" })).toBeVisible();
  for (const name of ["Trend", "Moved", "Rating"]) {
    await expect(
      table.getByRole("columnheader", { name, exact: true }),
    ).toBeHidden();
  }
  await expect(
    table.getByRole("columnheader", { name: "Open actions" }),
  ).toBeVisible();
  expect(
    await appsRegion(page)
      .locator('[data-slot="table-container"]')
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    table.getByRole("columnheader", { name: "Trend", exact: true }),
  ).toBeVisible();
});

test("the table keeps phone columns and reveals more on request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const headers = appsRegion(page).getByRole("columnheader");
  await expect(headers).toHaveText([
    "App",
    "Visibility",
    "7d",
    "Open actions",
    "More",
  ]);

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
  await page.goto("/?view=cards");

  const bands = card(page, "Tomato Clock").getByRole("img", {
    name: /^Rank bands/,
  });
  await hoverForTooltip(
    page,
    bands,
    page.getByRole("tooltip").getByText("#11–50"),
  );
});

test("the table sorts an app awaiting its first run last", async ({ page }) => {
  await page.goto("/?sort=top10&dir=asc");

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
  await page.goto("/");

  const header = appsRegion(page).getByRole("columnheader").first();
  await expect(header).toHaveText("App");
  const width = await header.evaluate(
    (node) => node.getBoundingClientRect().width,
  );

  expect(width).toBeLessThanOrEqual(200);
});
