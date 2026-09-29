import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
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

test("the dashboard outline reads in visual order on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(mainHeadings(page)).toHaveText([
    "Dashboard",
    "Top actions",
    "Keyword movers",
    "Apps",
    "Recent changes",
  ]);
});

test("apps and recent changes share a row once the sidebar collapses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
    "data-state",
    "collapsed",
  );

  const apps = page.getByRole("region", { name: "Apps" });
  const changes = page
    .getByRole("heading", { name: "Recent changes", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

  await expect(async () => {
    const appsBox = (await apps.boundingBox())!;
    const changesBox = (await changes.boundingBox())!;
    expect(changesBox.x).toBeGreaterThanOrEqual(appsBox.x + appsBox.width);
    expect(changesBox.y).toBeLessThan(appsBox.y + appsBox.height);
    expect(appsBox.y).toBeLessThan(changesBox.y + changesBox.height);
  }).toPass();
});

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
    .filter({ hasText: "Keyword movement" });
  await expect(tile).toContainText(`${up} climbing, ${down} falling`);
});

test("the apps heading stays put when the insights stream in", async ({
  page,
  context,
}) => {
  const release = await holdInsights(context);
  await page.goto("/", { waitUntil: "commit" });

  const heading = page.getByRole("heading", { name: "Apps", level: 2 });
  await expect(
    page.getByRole("heading", { name: "Top actions", level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="stat-tile-skeleton"]').first(),
  ).toBeVisible();
  const before = (await heading.boundingBox())!.y;

  await release();
  await expect(
    page.locator('[data-slot="app-grid"] > li').first(),
  ).toBeVisible();
  const after = (await heading.boundingBox())!.y;

  expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
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

const cardOf = (page: Page, heading: string) =>
  page
    .getByRole("heading", { name: heading, level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

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
    cardOf(page, "Top actions").getByRole("listitem").getByRole("link"),
    cardOf(page, "Keyword movers").getByRole("listitem").getByRole("link"),
    cardOf(page, "Recent changes").locator('a[href$="/changes"]'),
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

const fitsWidth = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

for (const width of [375, 768, 1024, 1440]) {
  for (const collapsed of width < 768 ? [false] : [false, true]) {
    test(`the dashboard fits and keeps its targets at ${width} px${collapsed ? " with the sidebar collapsed" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
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
        const actions = (await cardOf(page, "Top actions").boundingBox())!;
        const movers = (await cardOf(page, "Keyword movers").boundingBox())!;
        return {
          stacked: movers.y >= actions.y + actions.height,
          aligned: Math.round(movers.x) === Math.round(actions.x),
        };
      })
      .toEqual({ stacked: true, aligned: true });
  });
}

test("keyboard focus follows the visual order of the dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    cardOf(page, "Keyword movers").getByRole("listitem").first(),
  ).toBeVisible();

  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");

  const names: string[] = [];
  for (let step = 0; step < 16; step += 1) {
    await page.keyboard.press("Tab");
    names.push(
      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        return (
          active.getAttribute("aria-label") ??
          active.innerText.replace(/\s+/g, " ").trim()
        );
      }),
    );
  }
  const at = (pattern: RegExp) => names.findIndex((name) => pattern.test(name));

  expect(names[0]).toBe("Import app");
  expect(names[1]).toMatch(/of the daily request budget$/);
  expect(names[2]).toMatch(/^Critical .* Focus Timer · App Store · US$/);
  const order = [
    at(/^Open the Action Center$/),
    at(/^focus timer .*Focus Timer US/),
    at(/^Sort by$/),
    at(/^Cards$/),
    at(/^Focus Timer$/),
  ];
  expect(order.every((index) => index > 2)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});
