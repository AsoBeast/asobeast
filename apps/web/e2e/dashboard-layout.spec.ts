import { randomUUID } from "node:crypto";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import type { PortfolioSummary } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { PORTFOLIO_INSIGHTS } from "./portfolio-insights.mts";
import { seedCookies } from "./routes.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

const holdInsights = async (context: BrowserContext) => {
  const token = randomUUID();
  await seedCookies(context, { e2e_insights_hold: token });
  return () =>
    context.request.post(`${MOCK_API_URL}/__insights-holds/${token}/release`);
};

const statusLine = (page: Page) =>
  page.locator('[data-slot="portfolio-status"]');

const tileBoxes = async (page: Page) => {
  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.last()).toBeVisible();
  return tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
};

const mainHeadings = (page: Page) => page.getByRole("main").locator("h1, h2");

const APP_VIEWS = [
  { view: "table", path: "/" },
  { view: "cards", path: "/?view=cards" },
] as const;

const appsRegion = (page: Page) =>
  page.getByRole("region", { name: "Apps", exact: true });

const cardOf = (page: Page, heading: string) =>
  page
    .getByRole("heading", { name: heading, level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The element has no layout box");
  return {
    left: Math.round(box.x),
    right: Math.round(box.x + box.width),
    top: box.y,
    bottom: box.y + box.height,
  };
};

const fitsWidth = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("the dashboard outline reads in visual order on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(mainHeadings(page)).toHaveText([
    "Dashboard",
    "Keyword movers",
    "Do next",
    "Apps",
    "Listing changes",
    "Alerts",
  ]);
});

test("listing changes and alerts share a row once the dashboard is wide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const changes = cardOf(page, "Listing changes");
  const alerts = cardOf(page, "Alerts");
  await expect(alerts.getByRole("listitem").first()).toBeVisible();

  await expect(async () => {
    const changesBox = await boxOf(changes);
    const alertsBox = await boxOf(alerts);
    expect(alertsBox.left).toBeGreaterThanOrEqual(changesBox.right);
    expect(Math.round(alertsBox.top)).toBe(Math.round(changesBox.top));
    expect(Math.round(alertsBox.bottom)).toBe(Math.round(changesBox.bottom));
    expect(changesBox.right - changesBox.left).toBeGreaterThan(
      alertsBox.right - alertsBox.left,
    );
  }).toPass();
});

for (const { view, path } of APP_VIEWS) {
  test(`the ${view} view gives the apps the full width above listing changes and alerts`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);

    const apps = appsRegion(page);
    const changes = cardOf(page, "Listing changes");
    const alerts = cardOf(page, "Alerts");
    const movers = cardOf(page, "Keyword movers");
    const actions = cardOf(page, "Do next");
    await expect(async () => {
      const appsBox = await boxOf(apps);
      const changesBox = await boxOf(changes);
      const alertsBox = await boxOf(alerts);
      expect(appsBox.left).toBe(changesBox.left);
      expect(appsBox.right).toBe(alertsBox.right);
      expect(appsBox.left).toBe((await boxOf(movers)).left);
      expect(appsBox.right).toBe((await boxOf(actions)).right);
      expect(appsBox.top).toBeGreaterThanOrEqual((await boxOf(actions)).bottom);
      expect(changesBox.top).toBeGreaterThanOrEqual(appsBox.bottom);
      expect(alertsBox.top).toBeGreaterThanOrEqual(appsBox.bottom);
    }).toPass();
    expect(await fitsWidth(page)).toBe(true);
  });
}

test("the header states what the dashboard covers", async ({ page }) => {
  await page.goto("/");

  const { totals } = (await page.request
    .get("/api/backend/portfolio")
    .then((response) => response.json())) as PortfolioSummary;
  await expect(statusLine(page)).toContainText(
    `${totals.apps} apps · ${totals.trackedKeywords} keywords · ${totals.competitors} competitors`,
  );
  await expect(statusLine(page)).toContainText("Collected");
  await expect(statusLine(page)).toContainText("Daily run complete");
});

test("the header links the request budget to settings", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: /of the daily request budget/ }),
  ).toHaveAttribute("href", "/settings");
});

test("the first run page has no status line", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: "portfolio_empty", value: "1", url: "http://localhost:3000" },
    ]);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Track your first app", level: 1 }),
  ).toBeVisible();
  await expect(statusLine(page)).toHaveCount(0);
});

test("the pulse tiles form two rows of two on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const [first, second, third, fourth] = await tileBoxes(page);
  expect(Math.round(second.y)).toBe(Math.round(first.y));
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.y).toBeGreaterThanOrEqual(first.y + first.height);
  expect(Math.round(third.x)).toBe(Math.round(first.x));
  expect(Math.round(fourth.y)).toBe(Math.round(third.y));
});

test("the pulse tiles share one row on a desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const boxes = await tileBoxes(page);
  const tops = new Set(boxes.map((box) => Math.round(box.y)));
  expect(tops.size).toBe(1);
});

test("the movement tile reads its counts aloud", async ({ page }) => {
  await page.goto("/");

  const { up, down } = PORTFOLIO_INSIGHTS.totals.movement;
  const tile = page
    .locator('[data-slot="stat-tile"]')
    .filter({ hasText: "Moved in 30 days" });
  await expect(tile).toContainText(`${up} climbed`);
  await expect(tile).toContainText(`${down} fell`);
});

test("the apps heading stays put when the insights stream in", async ({
  page,
  context,
}) => {
  const release = await holdInsights(context);
  await page.goto("/", { waitUntil: "commit" });

  const actions = cardOf(page, "Do next");
  const heading = page.getByRole("heading", { name: "Apps", level: 2 });
  await expect(
    page.getByRole("heading", { name: "Do next", level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="stat-tile-skeleton"]').first(),
  ).toBeVisible();
  await expect(heading).toBeVisible();
  const before = {
    actions: (await boxOf(actions)).bottom,
    heading: (await boxOf(heading)).top,
  };

  await release();
  await expect(appsRegion(page).locator("tbody tr").first()).toBeVisible();
  const after = {
    actions: (await boxOf(actions)).bottom,
    heading: (await boxOf(heading)).top,
  };
  const apps = await boxOf(appsRegion(page));

  expect(Math.abs(after.actions - before.actions)).toBeLessThanOrEqual(8);
  expect(Math.abs(after.heading - before.heading)).toBeLessThanOrEqual(8);
  expect(apps.top).toBeGreaterThanOrEqual(after.actions);
  expect(after.heading - after.actions).toBeLessThanOrEqual(48);
});

for (const { width, columns } of [
  { width: 375, columns: 2 },
  { width: 1440, columns: 4 },
]) {
  test(`the pulse skeleton keeps the tile arrangement at ${width} px`, async ({
    page,
    context,
  }) => {
    const release = await holdInsights(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "commit" });

    const tiles = page.locator('[data-slot="stat-tile-skeleton"]');
    await expect(tiles).toHaveCount(4);
    const rows = () =>
      tiles.evaluateAll((nodes) => {
        const tops = nodes.map((node) =>
          Math.round(node.getBoundingClientRect().top),
        );
        return tops.map((top) => tops.indexOf(top));
      });

    await expect
      .poll(rows)
      .toEqual(columns === 2 ? [0, 0, 2, 2] : [0, 0, 0, 0]);
    await release();
  });
}

const undersizedTargets = (page: Page, minimum: number) =>
  page.getByRole("main").evaluate((main, min) => {
    const inline = (node: HTMLElement) =>
      node.tagName === "A" && getComputedStyle(node).display === "inline";
    return Array.from(
      main.querySelectorAll<HTMLElement>(
        'a, button, input, select, [role="tab"], [tabindex="0"]',
      ),
    )
      .filter((node) => node.getClientRects().length > 0 && !inline(node))
      .filter((node) => node.getBoundingClientRect().height < min)
      .map((node) => node.getAttribute("aria-label") ?? node.textContent)
      .slice(0, 5);
  }, minimum);

const rowLinkHeights = async (page: Page) => {
  const rows = [
    cardOf(page, "Do next").getByRole("listitem").getByRole("link"),
    cardOf(page, "Keyword movers").getByRole("listitem").getByRole("link"),
    cardOf(page, "Listing changes").getByRole("listitem").getByRole("link"),
    cardOf(page, "Alerts").getByRole("listitem").getByRole("link"),
  ];
  const heights = await Promise.all(
    rows.map((row) =>
      row.evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getClientRects().length > 0)
          .map((node) => node.getBoundingClientRect().height),
      ),
    ),
  );
  return heights.flat();
};

for (const { view, path } of APP_VIEWS) {
  for (const width of [375, 768, 1024, 1440]) {
    for (const collapsed of width < 768 ? [false] : [false, true]) {
      test(`the ${view} dashboard fits and keeps its targets at ${width} px${collapsed ? " with the sidebar collapsed" : ""}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(
          cardOf(page, "Alerts").getByRole("listitem").first(),
        ).toBeVisible();
        if (collapsed) {
          await page.keyboard.press("ControlOrMeta+b");
          await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
            "data-state",
            "collapsed",
          );
        }

        expect(await fitsWidth(page), "no horizontal scroll").toBe(true);
        expect(await undersizedTargets(page, 24)).toEqual([]);
        if (width === 375) {
          const rows = await rowLinkHeights(page);
          expect(rows.length).toBeGreaterThan(0);
          expect(rows.filter((height) => height < 40)).toEqual([]);
        }
      });
    }
  }
}

test("a feed row that fits one line keeps a phone sized target", async ({
  page,
}) => {
  await seedCookies(page.context(), { recent_changes_varied: "1" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const rows = cardOf(page, "Listing changes")
    .getByRole("listitem")
    .getByRole("link");
  await expect(rows.first()).toBeVisible();
  const heights = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height),
  );

  expect(heights.filter((height) => height < 40)).toEqual([]);
});

for (const { width, collapse, rows } of [
  { width: 768, collapse: false, rows: [0, 0, 2, 2] },
  { width: 1024, collapse: true, rows: [0, 0, 0, 0] },
]) {
  test(`a ${width} px tablet${collapse ? " with the sidebar collapsed" : ""} follows the dashboard width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto("/");
    if (collapse) await page.keyboard.press("ControlOrMeta+b");

    const tiles = page.locator('[data-slot="stat-tile"]');
    await expect(tiles).toHaveCount(4);
    await expect
      .poll(() =>
        tiles.evaluateAll((nodes) => {
          const tops = nodes.map((node) =>
            Math.round(node.getBoundingClientRect().top),
          );
          return tops.map((top) => tops.indexOf(top));
        }),
      )
      .toEqual(rows);

    await expect
      .poll(async () => {
        const movers = await boxOf(cardOf(page, "Keyword movers"));
        const actions = await boxOf(cardOf(page, "Do next"));
        return {
          stacked: actions.top >= movers.bottom,
          aligned: actions.left === movers.left,
        };
      })
      .toEqual({ stacked: true, aligned: true });

    await expect
      .poll(async () => {
        const changes = await boxOf(cardOf(page, "Listing changes"));
        const alerts = await boxOf(cardOf(page, "Alerts"));
        return {
          stacked: alerts.top >= changes.bottom,
          aligned: alerts.left === changes.left,
          matched: alerts.right === changes.right,
        };
      })
      .toEqual({ stacked: true, aligned: true, matched: true });
  });
}

const FOCUS_STEPS = 80;

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    return (
      active.getAttribute("aria-label") ??
      (active.innerText ?? active.textContent ?? "").replace(/\s+/g, " ").trim()
    );
  });

for (const { view, path, toolbar } of [
  {
    ...APP_VIEWS[0],
    toolbar: [/^About visibility$/, /^Columns$/, /^Table$/, /^App$/],
  },
  {
    ...APP_VIEWS[1],
    toolbar: [/^About visibility$/, /^Sort by$/, /^Cards$/],
  },
]) {
  test(`keyboard focus follows the visual order of the ${view} dashboard`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(
      cardOf(page, "Keyword movers").getByRole("listitem").first(),
    ).toBeVisible();
    await expect(
      cardOf(page, "Alerts").getByRole("listitem").first(),
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");

    const lastStop = /Rival Focus changed its subtitle/;
    const names: string[] = [];
    for (let step = 0; step < FOCUS_STEPS; step += 1) {
      await page.keyboard.press("Tab");
      const name = await focusedName(page);
      names.push(name);
      if (lastStop.test(name)) break;
    }
    const at = (pattern: RegExp) =>
      names.findIndex((name) => pattern.test(name));

    expect(names[0]).toBe("Dashboard range, Last 30 days");
    expect(names[1]).toBe("Import app");
    expect(names[2]).toMatch(/of the daily request budget$/);
    expect(names).not.toContain("");
    const order = [
      at(/^Visibility /),
      at(/^Keywords in top 10 /),
      at(/^Moved in 30 days /),
      at(/^Open actions /),
      at(/^All$/),
      at(/^focus timer .*Focus Timer US/),
      at(/^Critical .* Focus Timer · App Store · US$/i),
      at(/^Open the Action Center$/),
      ...toolbar.map(at),
      at(/^Focus Timer$/),
      names.lastIndexOf("All"),
      at(/Focus Timer Pro/),
      at(lastStop),
    ];
    expect(order.every((index) => index > 2)).toBe(true);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
}
