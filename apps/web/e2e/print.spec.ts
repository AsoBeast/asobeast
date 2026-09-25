import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_1_DETAIL } from "./fixtures.mts";

const OVERVIEW = `/apps/${APP_1_DETAIL.id}`;
const APP_NAME = APP_1_DETAIL.name ?? "";

async function open(page: Page, path: string, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

function printed(page: Page) {
  return page.emulateMedia({ media: "print" });
}

function bodyLuminance(page: Page, property: "backgroundColor" | "color") {
  return page.evaluate((name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = getComputedStyle(document.body)[name];
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }, property);
}

test("prints in the light theme while the dark theme is stored", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
  await open(page, OVERVIEW);
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await bodyLuminance(page, "backgroundColor")).toBeLessThan(0.2);

  await printed(page);

  expect(await bodyLuminance(page, "backgroundColor")).toBeGreaterThan(0.9);
  expect(await bodyLuminance(page, "color")).toBeLessThan(0.3);
  expect(
    await page
      .locator("html")
      .evaluate((node) => getComputedStyle(node).colorScheme),
  ).toBe("light");
});

test("leaves the app shell out of the printout", async ({ page }) => {
  await open(page, OVERVIEW);
  const navigation = page.getByRole("navigation", { name: "Main" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);

  await printed(page);

  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Store page" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Link store listing" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: APP_NAME }),
  ).toBeVisible();

  const layout = await page.evaluate(() => {
    const main = document.querySelector("main");
    const inset = document.querySelector("[data-slot='sidebar-inset']");
    if (!main || !inset) throw new Error("shell missing");
    const box = main.getBoundingClientRect();
    const style = getComputedStyle(inset);
    return {
      left: box.left,
      right: box.right,
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      margin: style.marginTop,
      shadow: style.boxShadow,
    };
  });
  expect(layout.left).toBeLessThan(1);
  expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
  expect(layout.margin).toBe("0px");
  expect(layout.shadow).toBe("none");
});

test("leaves the system banner out of the printout", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e_store_broken", value: "1", domain: "localhost", path: "/" },
  ]);
  await open(page, OVERVIEW);
  const banner = page
    .getByRole("alert")
    .filter({ hasText: "parsing looks broken" });
  await expect(banner).toBeVisible();

  await printed(page);

  await expect(banner).toBeHidden();
});

test("leaves toasts out of the printout", async ({ page }) => {
  await open(page, OVERVIEW);
  await page.getByRole("button", { name: "Run daily" }).click();
  const toast = page.getByText(/^Queued · rank checks for 5 keywords$/);
  await expect(toast).toBeVisible();

  await printed(page);

  await expect(toast).toBeHidden({ timeout: 1000 });
});

const OVERVIEW_WITH_RANGES = `${OVERVIEW}?range=90d&categoryRange=7d`;
const PAPER_STAND_IN = "#main-content { width: 600px; }";

function fitsInCards(page: Page) {
  return page.evaluate((rule) => {
    const style = document.createElement("style");
    style.textContent = rule;
    document.head.append(style);
    const charts = Array.from(
      document.querySelectorAll<SVGSVGElement>("svg.recharts-surface"),
    ).map((svg) => {
      const content = svg.closest<HTMLElement>("[data-slot='card-content']");
      if (!content) throw new Error("chart outside a card");
      const padding = getComputedStyle(content);
      const room =
        content.clientWidth -
        Number.parseFloat(padding.paddingLeft) -
        Number.parseFloat(padding.paddingRight);
      const width = svg.getBoundingClientRect().width;
      return {
        fits: width <= room + 1,
        grew: width > Number(svg.getAttribute("width")) + 1,
      };
    });
    style.remove();
    return charts;
  }, PAPER_STAND_IN);
}

function cardWidth(page: Page, region: string) {
  return page.getByRole("region", { name: region }).evaluate((node) => {
    const card = node.closest("[data-slot='card']");
    if (!card) throw new Error("chart outside a card");
    return Math.round(card.getBoundingClientRect().width);
  });
}

test("prints an overview report header with the ranges shown", async ({
  page,
}) => {
  await open(page, OVERVIEW_WITH_RANGES);
  await expect(page.getByText("Overview report")).toBeHidden();

  await printed(page);

  await expect(
    page.getByRole("heading", { level: 1, name: APP_NAME }),
  ).toBeVisible();
  await expect(page.getByText("Overview report")).toBeVisible();
  for (const fact of [
    "Home storefront: United States",
    "Visibility: Last 90 days",
    "Rank bands: Last 30 days",
    "Category ranks: Last 7 days",
  ]) {
    await expect(page.getByText(fact, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByText(/^Printed .+ \(UTC\) from asobeast$/),
  ).toBeVisible();
});

test("prints the overview ranges as words and leaves its links out", async ({
  page,
}) => {
  await open(page, OVERVIEW_WITH_RANGES);
  await expect(page.getByRole("tablist")).toHaveCount(3);

  await printed(page);

  await expect(page.getByRole("tablist")).toHaveCount(0);
  const visibility = page
    .getByRole("region", { name: "Search visibility over time" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(visibility.getByText("Last 90 days")).toBeVisible();
  const category = page
    .getByRole("region", { name: "Category chart position over time" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(category.getByText("Last 7 days")).toBeVisible();
  await expect(page.getByRole("link", { name: "View comparison" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Open the Action Center" }),
  ).toHaveCount(0);
});

test("prints the overview in one column with every chart inside its card", async ({
  page,
}) => {
  await open(page, OVERVIEW);
  await expect(
    page.getByRole("region", { name: "Category chart position over time" }),
  ).toBeVisible();

  await printed(page);

  const main = await page
    .locator("main")
    .evaluate((node) => Math.round(node.getBoundingClientRect().width));
  for (const region of [
    "Search visibility over time",
    "Keyword rank distribution",
    "Category chart position over time",
  ]) {
    expect(await cardWidth(page, region)).toBe(main);
  }

  const charts = await fitsInCards(page);
  expect(charts.length).toBeGreaterThanOrEqual(3);
  expect(charts.filter((chart) => !chart.fits)).toEqual([]);
  expect(charts.filter((chart) => chart.grew)).toEqual([]);
  expect(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(".recharts-tooltip-wrapper"),
        (node) => getComputedStyle(node).display,
      ),
    ),
  ).not.toContain("block");
});

test("leaves the first run timeline out of the printout", async ({ page }) => {
  await open(page, "/apps/app-2");
  const timeline = page.getByRole("heading", {
    name: "One step is still finishing.",
  });
  await expect(timeline).toBeVisible();

  await printed(page);

  await expect(timeline).toBeHidden();
});

test("prints grades, badges and legends in colour with the grade word", async ({
  page,
}) => {
  await open(page, OVERVIEW);
  const graded = page.locator("[data-grade='strong']").first();
  const after = () =>
    graded.evaluate((node) => getComputedStyle(node, "::after").content);
  expect(await after()).toBe("none");

  await printed(page);

  expect(await after()).not.toBe("none");
  for (const selector of [
    "[data-grade='strong']",
    "[data-slot='badge']",
    "[data-slot='chart']",
  ]) {
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((node) =>
          getComputedStyle(node).getPropertyValue("print-color-adjust"),
        ),
    ).toBe("exact");
  }
});

const RANKINGS = `/apps/${APP_1_DETAIL.id}/rankings`;

test("prints a rankings report header and the windows as words", async ({
  page,
}) => {
  await open(page, `${RANKINGS}?range=7d&movers=14`);

  await printed(page);

  await expect(page.getByText("Rankings report")).toBeVisible();
  await expect(
    page.getByText("Ranking history: Last 7 days", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("SERP movers: Last 14 days", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Last 14 days", { exact: true })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("prints the rankings controls as plain labels or not at all", async ({
  page,
}) => {
  await open(page, RANKINGS);
  const chip = page.getByRole("button", {
    name: "Remove focus timer (US) from the chart",
  });
  await expect(chip.locator("svg")).toBeVisible();

  await printed(page);

  for (const name of ["5 selected", "Export rankings to CSV", "Track"]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("focus timer (US)");
  await expect(chip).toHaveCSS("border-top-width", "0px");
  await expect(chip.locator("svg")).toBeHidden();
  expect(
    await chip
      .locator("[data-swatch]")
      .evaluate((node) =>
        getComputedStyle(node).getPropertyValue("print-color-adjust"),
      ),
  ).toBe("exact");
});

test("prints the rankings in one column with the chart inside its card", async ({
  page,
}) => {
  await open(page, RANKINGS);
  await expect(
    page.getByRole("region", { name: "Keyword rank positions" }),
  ).toBeVisible();

  await printed(page);

  const main = await page
    .locator("main")
    .evaluate((node) => Math.round(node.getBoundingClientRect().width));
  expect(await cardWidth(page, "Keyword rank positions")).toBe(main);
  const movers = await page
    .getByText("SERP movers", { exact: true })
    .evaluate((node) => {
      const card = node.closest("[data-slot='card']");
      if (!card) throw new Error("movers outside a card");
      return Math.round(card.getBoundingClientRect().width);
    });
  expect(movers).toBe(main);

  const charts = await fitsInCards(page);
  expect(charts.length).toBeGreaterThanOrEqual(1);
  expect(charts.filter((chart) => !chart.fits)).toEqual([]);
});

async function countPrints(page: Page) {
  await page.addInitScript(() => {
    window.print = () => {
      const root = document.documentElement;
      root.dataset.printCalls = String(
        Number(root.dataset.printCalls ?? 0) + 1,
      );
    };
  });
}

test("offers print report on the two report pages only", async ({ page }) => {
  await countPrints(page);
  const action = page.getByRole("button", { name: "Print report" });

  await open(page, `${OVERVIEW}/keywords`);
  await expect(action).toHaveCount(0);

  await open(page, RANKINGS);
  await expect(action).toBeVisible();

  await open(page, OVERVIEW);
  await action.click();
  await expect(page.locator("html")).toHaveAttribute("data-print-calls", "1");

  await printed(page);
  await expect(action).toHaveCount(0);
});

const REPORTS = [
  ["overview", OVERVIEW],
  ["rankings", RANKINGS],
] as const;

const MIN_REPORT_BYTES = 10_000;

test("prints both reports to pdf in the light theme", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));

  for (const [name, path] of REPORTS) {
    await open(page, path);
    await expect(page.locator("html")).toHaveClass(/dark/);

    const file = testInfo.outputPath(`${name}.pdf`);
    const pdf = await page.pdf({
      path: file,
      format: "A4",
      printBackground: false,
      preferCSSPageSize: true,
    });

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(MIN_REPORT_BYTES);
    await testInfo.attach(`${name}.pdf`, {
      path: file,
      contentType: "application/pdf",
    });
  }
});

test("leaves the rankings empty state actions out of the printout", async ({
  page,
}) => {
  for (const [path, name] of [
    ["/apps/app-2/rankings", "Go to keywords"],
    ["/apps/app-long/rankings?range=7d", "Widen to 90 days"],
  ] as const) {
    await open(page, path);
    const action = page.getByRole("main").getByText(name, { exact: true });
    await expect(action).toBeVisible();

    await printed(page);
    await expect(action).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  }
});
