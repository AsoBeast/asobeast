import type { Locator, Page } from "@playwright/test";
import type { PortfolioHistory } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import {
  PORTFOLIO,
  PORTFOLIO_VISIBILITY,
  portfolioRangeDeltasOf,
} from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { startedSetup } from "./setup-session.mts";

const CHECKED_APPS = PORTFOLIO.apps.filter(
  (app) => app.lastCapturedAt !== null,
).length;

const tile = (page: Page, label: string) =>
  page.locator('[data-slot="stat-tile"]').filter({ hasText: label });

const appsTable = (page: Page) =>
  page
    .getByRole("region", { name: "Apps", exact: true })
    .getByRole("table", { name: "Apps in this workspace" });

const chartLines = (page: Page) =>
  page.getByRole("list", { name: "Chart lines" }).getByRole("listitem");

const rankBands = (page: Page) =>
  page.getByRole("list", { name: "Rank bands" }).getByRole("listitem");

const breakdown = (page: Page) =>
  page.getByRole("region", { name: /^By (app|store)$/ });

const boxOf = async (target: Locator) => {
  const box = await target.boundingBox();
  if (box === null) throw new Error("The element has no layout box");
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
  };
};

test("a fresh install invites an import instead of showing an empty dashboard", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "portfolio_empty",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Track your first app", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="stat-tile"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Alerts", level: 2 }),
  ).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
});

test("the empty dashboard lists what an import delivers", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "portfolio_empty",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  const deliveries = page
    .getByRole("list", { name: "What you get" })
    .getByRole("listitem");
  await expect(deliveries).toHaveCount(3);
  await expect(deliveries.first()).toContainText("within minutes");
});

test("an app awaiting its first run says so instead of showing zeros", async ({
  page,
}) => {
  await page.goto("/?view=cards");

  const card = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByText("Pending App", { exact: true }) });

  await expect(card).toHaveCount(1);
  await expect(
    card.getByText(
      "Collecting the first positions. Visibility appears within the hour.",
    ),
  ).toBeVisible();
  await expect(card.getByText("0", { exact: true })).toHaveCount(0);
});

test("a table row awaiting its first run shows dashes instead of zeros", async ({
  page,
}) => {
  await page.goto("/");

  const row = appsTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "Pending App" }) });

  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell").nth(2)).toHaveText("—");
  await expect(row.getByText("0", { exact: true })).toHaveCount(0);
  await expect(row.getByText(/7d/)).toHaveCount(0);
});

test("an app in setup carries a progress chip that opens its setup", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/?view=cards");

  const card = (name: string) =>
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) });
  const chip = card("Focus Timer").getByRole("link", { name: "Setup 1 of 3" });

  await expect(chip).toHaveAttribute("href", "/apps/app-1/setup");
  expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(24);
  await expect(
    card("Habit Tracker").getByRole("link", { name: /^Setup / }),
  ).toHaveCount(0);
  await chip.click();
  await expect(page).toHaveURL("/apps/app-1/setup");
});

test("a table row in setup carries a progress link that opens its setup", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/");

  const links = appsTable(page).getByRole("link", { name: /^Setup / });

  await expect(links).toHaveCount(1);
  await expect(links).toHaveText("Setup 1 of 3");
  await expect(links).toHaveAttribute("href", "/apps/app-1/setup");
  await expect(
    appsTable(page)
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: /^Setup / }) })
      .getByRole("link", { name: "Focus Timer" }),
  ).toHaveAttribute("href", "/apps/app-1");
  expect((await links.boundingBox())?.height).toBeGreaterThanOrEqual(24);
  await links.click();
  await expect(page).toHaveURL("/apps/app-1/setup");
});

test("the sparkline end marker stays round however wide the card is", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?view=cards");

  const marker = page.locator('[data-slot="sparkline-end"]').first();
  await expect(marker).toBeVisible();

  const box = await marker.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  expect(box.height).toBeGreaterThan(0);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
});

test("movers and moved counts draw the arrow the change pills draw", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const main = page.locator("main");
  await expect(
    main.getByRole("link").filter({ hasText: "→" }).first(),
  ).toBeVisible();
  await expect(main).not.toContainText(/[▲▼]/);
  await expect(main.locator("svg.lucide-arrow-up").first()).toBeVisible();
  await expect(main.locator("svg.lucide-arrow-down").first()).toBeVisible();
});

test("the summary tile numbers stay on one line when the strip narrows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.last()).toBeVisible();

  const offsets = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const value = node.querySelector(".numeric") as HTMLElement;
      return Math.round(
        value.getBoundingClientRect().top - node.getBoundingClientRect().top,
      );
    }),
  );

  expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThanOrEqual(1);
});

test("the summary tiles state the window they measure", async ({ page }) => {
  await page.goto("/");

  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles.locator(":scope > span:first-child")).toHaveText([
    "Visibility",
    "Keywords in top 10",
    "Moved in 30 days",
    "Open actions",
  ]);
  await expect(tiles.getByText(/^weighted across \d+ apps$/)).toBeVisible();
  await expect(
    tiles.getByText(/^\d+ started ranking · \d+ dropped out$/),
  ).toBeVisible();
});

test("the visibility tile reads the portfolio figure and its change over the range", async ({
  page,
}) => {
  await page.goto("/");

  const { current } = PORTFOLIO_VISIBILITY;
  const month = portfolioRangeDeltasOf(30).visibility;
  const visibility = tile(page, "Visibility");
  await expect(visibility).toHaveCount(1);
  await expect(
    visibility.getByText(String(Math.round(current)), { exact: true }),
  ).toBeVisible();
  await expect(
    visibility.getByText(`+${Math.round(month)} 30d`, { exact: true }),
  ).toBeVisible();
  await expect(
    visibility.getByText(`weighted across ${CHECKED_APPS} apps`, {
      exact: true,
    }),
  ).toBeVisible();
});

test("one chart draws visibility across the apps against the previous period", async ({
  page,
}) => {
  await page.goto("/");

  const chart = page.getByRole("region", {
    name: "Visibility across your apps over the last 30 days",
  });
  await expect(chart).toBeVisible();
  await expect(chart.locator("svg.recharts-surface")).toBeVisible();
  await expect(chartLines(page)).toHaveText([
    "Last 30 days",
    "Previous 30 days",
    "Listing change",
  ]);
  await expect(
    page.getByRole("main").locator('[data-slot="chart"]'),
  ).toHaveCount(1);
});

test("a tile draws its own chart, writes the url and keeps the keyboard", async ({
  page,
}) => {
  await page.goto("/");

  const visibility = tile(page, "Visibility");
  const top10 = await hydrated(tile(page, "Keywords in top 10"));
  await expect(visibility).toHaveAttribute("aria-pressed", "true");
  await top10.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/[?&]metric=top10/);
  await expect(top10).toHaveAttribute("aria-pressed", "true");
  await expect(visibility).toHaveAttribute("aria-pressed", "false");
  await expect(top10).toBeFocused();
  await expect(
    page.getByRole("region", {
      name: "Keywords by rank across your apps over the last 30 days",
    }),
  ).toBeVisible();
  await expect(rankBands(page)).toHaveText([
    "#1",
    "#2–3",
    "#4–10",
    "#11–50",
    "#51+",
    "Unranked",
    "Listing change",
  ]);

  await tile(page, "Moved in 30 days").click();
  await expect(page).toHaveURL(/[?&]metric=moved/);
  await expect(
    page.getByRole("region", {
      name: "Keywords that climbed and fell each day over the last 30 days",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Chart bars" }).getByRole("listitem"),
  ).toHaveText(["Climbed", "Fell"]);

  await tile(page, "Open actions").click();
  await expect(page).toHaveURL(/[?&]metric=actions/);
  await expect(
    page.getByText("Actions opened and closed each day", { exact: true }),
  ).toBeVisible();

  await visibility.click();
  await expect(page).not.toHaveURL(/metric=/);
  await expect(
    page.getByRole("main").locator('[data-slot="chart"]'),
  ).toHaveCount(1);
});

test("the range beside import app redraws the chart for the chosen days", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/portfolio/history")) {
      asked.push(url.searchParams.get("days") ?? "");
    }
  });
  await page.goto("/");

  const range = await hydrated(
    page.getByRole("combobox", { name: "Dashboard range, Last 30 days" }),
  );
  await range.click();
  await page.getByRole("option", { name: "Last 90 days" }).click();

  await expect(page).toHaveURL(/[?&]range=90/);
  await expect(chartLines(page)).toHaveText([
    "Last 90 days",
    "Previous 90 days",
    "Listing change",
  ]);
  await expect(
    page.getByRole("region", {
      name: "Visibility across your apps over the last 90 days",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Dashboard range, Last 90 days" }),
  ).toBeFocused();
  expect(asked).toContain("90");
  await expect(tile(page, "Moved in 90 days")).toBeVisible();
  await expect(tile(page, "Visibility")).toContainText(
    `+${Math.round(portfolioRangeDeltasOf(90).visibility)} 90d`,
  );
  expect(portfolioRangeDeltasOf(90).visibility).not.toBe(
    portfolioRangeDeltasOf(30).visibility,
  );
  await expect(page.getByRole("main")).toContainText(
    "Over the last 90 days visibility is",
  );
  await expect(breakdown(page)).toContainText("Sorted by change over 90 days");

  await page.reload();
  await expect(chartLines(page).first()).toHaveText("Last 90 days");
});

test("a link with a metric and a range opens that chart", async ({ page }) => {
  await page.goto("/?metric=top10&range=7");

  await expect(tile(page, "Keywords in top 10")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("region", {
      name: "Keywords by rank across your apps over the last 7 days",
    }),
  ).toBeVisible();
  await expect(rankBands(page).first()).toHaveText("#1");
});

test("the chart marks today as still checking while the daily run is in progress", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e_run_running",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  await expect(chartLines(page)).toHaveText([
    "Last 30 days",
    "Still checking",
    "Previous 30 days",
    "Listing change",
  ]);
});

test("the sentence under the title reads the last run first, then the range", async ({
  page,
}) => {
  await page.goto("/");

  const month = Math.round(portfolioRangeDeltasOf(30).visibility);
  await expect(page.getByRole("main").locator("p").first()).toHaveText(
    `In the last run 2 keywords climbed and 1 fell. Over the last 30 days visibility is up ${month}.`,
  );
});

test("the sentence reads the range alone until a run can be compared with the day before", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "portfolio_insights_fresh",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/");

  await expect(page.getByRole("main").locator("p").first()).toHaveText(
    "Movement appears after 30 days of daily runs.",
  );
});

test("the list beside the chart breaks the figure down by app and follows the tab", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const list = breakdown(page);
  await expect(
    list.getByRole("heading", { name: "By app", level: 2 }),
  ).toBeVisible();
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(CHECKED_APPS);
  await expect(rows.first().getByRole("button")).toHaveAccessibleName(
    "Focus Timer iOS · US, App Store · US, 62 now, +10 30d",
  );
  await expect(rows.first().getByRole("button")).toHaveText(
    /^Focus TimeriOS · US62\+10 30d$/,
  );
  await expect(rows.last().getByRole("button")).toHaveAccessibleName(
    "Habit Tracker iOS · US, App Store · US, 10 now, no 30d data",
  );
  await expect(list).toContainText("Sorted by change over 30 days");

  const chart = await boxOf(page.locator('[data-slot="chart"]'));
  const beside = await boxOf(list);
  expect(beside.left).toBeGreaterThanOrEqual(chart.right);
  expect(beside.top).toBeLessThan(chart.bottom);

  await (await hydrated(tile(page, "Moved in 30 days"))).click();
  await expect(rows.first().getByRole("button")).toHaveAccessibleName(
    "Focus Timer iOS · US, App Store · US, 3 climbing, 1 falling",
  );
  await expect(list).toContainText("Sorted by keywords moved in 30 days");

  await tile(page, "Open actions").click();
  await expect(rows.first().getByRole("button")).toHaveAccessibleName(
    "Focus Timer iOS · US, App Store · US, 5 open, 1 critical",
  );
  await expect(list).toContainText("Sorted by priority");
});

for (const width of [375, 1440]) {
  test(`a long app name truncates inside its column at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const button = await hydrated(
      breakdown(page).getByRole("listitem").first().getByRole("button"),
    );
    const fit = await button.evaluate(
      (row, long) => {
        const name = [...row.querySelectorAll("span")].find(
          (span) => span.textContent === "Focus Timer",
        );
        const figure = row.querySelector(".numeric");
        if (!name?.parentElement || !figure) return null;
        name.textContent = long;
        return {
          name: name.getBoundingClientRect().right,
          cell: name.parentElement.getBoundingClientRect().right,
          figure: figure.getBoundingClientRect().left,
          truncated: name.scrollWidth > name.clientWidth,
        };
      },
      `Focus Timer ${"Pomodoro ".repeat(12)}`.trim(),
    );

    expect(fit).not.toBeNull();
    expect(fit?.truncated).toBe(true);
    expect(fit?.name).toBeLessThanOrEqual((fit?.cell ?? 0) + 0.5);
    expect(fit?.name).toBeLessThanOrEqual(fit?.figure ?? 0);
  });
}

const TWIN_NAME = "Meme Maker - AI Meme Generator";

for (const width of [1280, 1440, 1600]) {
  test(`two listings of one long named app show their store at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");

    const list = breakdown(page);
    const marks = [];
    for (const original of ["Focus Timer iOS · US", "Tomato Clock"]) {
      const row = await hydrated(
        list.getByRole("button", { name: new RegExp(`^${original}`) }),
      );
      marks.push(
        await row.evaluate((button, twin) => {
          const name = [...button.querySelectorAll("span")].find(
            (span) =>
              span.textContent === "Focus Timer" ||
              span.textContent === "Tomato Clock",
          );
          const mark = name?.nextElementSibling;
          const figure = button.querySelector(".numeric");
          if (!name || !(mark instanceof HTMLElement) || !figure) return null;
          name.textContent = twin;
          const box = mark.getBoundingClientRect();
          return {
            text: mark.textContent,
            whole: mark.scrollWidth <= mark.clientWidth && box.width > 0,
            beforeFigure: box.right <= figure.getBoundingClientRect().left,
          };
        }, TWIN_NAME),
      );
    }

    expect(marks).toEqual([
      { text: "iOS · US", whole: true, beforeFigure: true },
      { text: "Play · DE", whole: true, beforeFigure: true },
    ]);
  });
}

test("pressing an app draws the chart for it alone and the chip returns to every app", async ({
  page,
}) => {
  const asked: Array<string | null> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/portfolio/history")) {
      asked.push(url.searchParams.get("appId"));
    }
  });
  await page.goto("/");

  const row = breakdown(page).getByRole("button", {
    name: /^Focus Timer iOS · DE, App Store · DE/,
  });
  await (await hydrated(row)).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/[?&]scope=app-1-de/);
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(row).toBeFocused();
  await expect(
    page.getByRole("region", {
      name: "Visibility of Focus Timer (DE) over the last 30 days",
    }),
  ).toBeVisible();
  expect(asked).toContain("app-1-de");
  await expect(breakdown(page).getByRole("listitem")).toHaveCount(CHECKED_APPS);
  await expect(tile(page, "Visibility")).toContainText(
    String(Math.round(PORTFOLIO_VISIBILITY.current)),
  );

  await page.reload();
  await expect(row).toHaveAttribute("aria-pressed", "true");

  const chip = page.getByRole("button", {
    name: "Focus Timer (DE), show every app",
  });
  await (await hydrated(chip)).click();
  await expect(page).not.toHaveURL(/scope=/);
  await expect(chip).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("region", {
      name: "Visibility across your apps over the last 30 days",
    }),
  ).toBeVisible();
});

test("the breakdown pools each store and a store scopes the chart", async ({
  page,
}) => {
  const asked: Array<string | null> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/portfolio/history")) {
      asked.push(url.searchParams.get("store"));
    }
  });
  await page.goto("/?scope=app-1-de");

  const list = breakdown(page);
  const stores = list.getByRole("tab", { name: "Stores" });
  await (await hydrated(stores)).click();

  await expect(page).toHaveURL(/[?&]by=store/);
  await expect(page).not.toHaveURL(/scope=/);
  await expect(stores).toBeFocused();
  await expect(
    list.getByRole("heading", { name: "By store", level: 2 }),
  ).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveText([
    /^Google Play1 app/,
    /^App Store3 apps/,
  ]);

  await list.getByRole("button", { name: /^Google Play/ }).click();
  await expect(page).toHaveURL(/[?&]scope=GOOGLE_PLAY/);
  await expect(
    page.getByRole("region", {
      name: "Visibility of Google Play over the last 30 days",
    }),
  ).toBeVisible();
  expect(asked).toContain("GOOGLE_PLAY");
});

test("releasing a scoped app beyond the cut hands focus to the link to the table", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "portfolio_many", value: "1", url: "http://localhost:3000" },
    ]);
  await page.goto("/");

  const list = breakdown(page);
  const rows = list.getByRole("listitem");
  const more = list.getByRole("link", { name: /more below$/ });
  await expect(rows).toHaveCount(6);
  await expect(more).toBeVisible();

  const { apps } = (await page.request
    .get("/api/backend/portfolio/history?days=30")
    .then((response) => response.json())) as PortfolioHistory;
  const shown = await rows
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.id));
  const cut = (apps ?? []).find(
    ({ appId }) => !shown.includes(`breakdown-${appId}`),
  );
  expect(cut).toBeDefined();

  for (const release of ["row", "chip"] as const) {
    await page.goto(`/?scope=${cut?.appId}`);
    await expect(rows).toHaveCount(7);
    const control =
      release === "row"
        ? list.getByRole("button", { pressed: true })
        : page.getByRole("button", { name: /, show every app$/ });
    await (await hydrated(control)).focus();
    await page.keyboard.press("Enter");

    await expect(page).not.toHaveURL(/scope=/);
    await expect(rows).toHaveCount(6);
    await expect(more).toBeFocused();
  }
});

test("one checked app draws its chart without a breakdown list", async ({
  page,
}) => {
  await page.route("**/api/backend/portfolio/history**", async (route) => {
    const response = await route.fetch();
    const history = (await response.json()) as PortfolioHistory;
    await route.fulfill({
      response,
      json: { ...history, apps: history.apps?.slice(0, 1) },
    });
  });
  await page.goto("/");
  await expect(breakdown(page)).toBeVisible();

  const range = await hydrated(
    page.getByRole("combobox", { name: "Dashboard range, Last 30 days" }),
  );
  await range.click();
  await page.getByRole("option", { name: "Last 7 days" }).click();

  await expect(
    page.getByRole("region", {
      name: "Visibility across your apps over the last 7 days",
    }),
  ).toBeVisible();
  await expect(breakdown(page)).toHaveCount(0);
});

test("a scope that names no app is ignored", async ({ page }) => {
  await page.goto("/?scope=app-elsewhere");

  await expect(
    page.getByRole("region", {
      name: "Visibility across your apps over the last 30 days",
    }),
  ).toBeVisible();
  await expect(
    breakdown(page).getByRole("button", { pressed: true }),
  ).toHaveCount(0);
});

test("the chart marks the days a listing changed and its tooltip names the apps that moved", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const chart = page.getByRole("region", {
    name: "Visibility across your apps over the last 30 days",
  });
  await expect(chart.locator(".recharts-reference-line")).toHaveCount(2);

  const plot = await boxOf(chart.locator(".recharts-cartesian-grid"));
  const dayWidth = (plot.right - plot.left) / 29;
  await page.mouse.move(
    plot.right - 5 * dayWidth,
    (plot.top + plot.bottom) / 2,
  );

  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toContainText("Largest moves that day");
  await expect(tooltip).toContainText("Focus Timer (US) · Title changed");

  await page.goto("/?range=7");
  await expect(
    page
      .getByRole("region", {
        name: "Visibility across your apps over the last 7 days",
      })
      .locator(".recharts-reference-line"),
  ).toHaveCount(1);
});

test("the moved chart says its bars count daily moves", async ({ page }) => {
  await page.goto("/?metric=moved");

  await expect(page.getByRole("main")).toContainText(
    "A keyword that moves on several days counts on each. The tile compares the first and the last day.",
  );
});

test("the open actions tile says so when no action set has been generated", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e_actions_ungenerated",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  const actions = tile(page, "Open actions");
  await expect(actions).toHaveCount(1);
  await expect(actions).toContainText("—");
  await expect(actions).toContainText("Not generated yet");
});

const middleOf = async (target: Locator): Promise<number> => {
  const box = await target.boundingBox();
  if (box === null) throw new Error("The element has no layout box");
  return box.y + box.height / 2;
};

const trendOffset = async (value: Locator): Promise<number> => {
  const parts = value.locator(":scope > span > span");
  return Math.abs(
    (await middleOf(parts.first())) - (await middleOf(parts.last())),
  );
};

test("the top 10 trend sits level with its figure", async ({ page }) => {
  await page.goto("/");

  const value = tile(page, "Keywords in top 10")
    .locator(":scope > span")
    .nth(1);
  await expect(value).toContainText("30d");

  expect(await trendOffset(value)).toBeLessThanOrEqual(2);
});

test("the visibility trend sits level with its figure", async ({ page }) => {
  await page.goto("/");

  const value = tile(page, "Visibility").locator(":scope > span").nth(1);
  await expect(value).toContainText("30d");

  expect(await trendOffset(value)).toBeLessThanOrEqual(2);
});
