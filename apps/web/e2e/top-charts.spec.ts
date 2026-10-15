import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { TOP_CHART_APPS, TOP_CHART_DATES, utcDaysAgo } from "./fixtures.mts";

const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const chartTable = (page: Page) => page.getByRole("table");

const pick = async (page: Page, control: string, option: string) => {
  await page.getByRole("combobox", { name: control }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("renders the chart for the default filters", async ({ page }) => {
  await page.goto("/charts");

  await expect(
    page.getByRole("heading", { level: 1, name: "Top charts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Store" }).getByRole("tab", {
      name: "App Store",
    }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "Country" })).toHaveText(
    "US · United States",
  );
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
  const rows = chartTable(page).locator("tbody tr");
  await expect(rows).toHaveCount(TOP_CHART_APPS.length);
  const first = rows.first();
  await expect(first.getByRole("cell").first()).toHaveText("1");
  await expect(first).toContainText(TOP_CHART_APPS[0].title);
  await expect(first).toContainText(TOP_CHART_APPS[0].developer ?? "");
});

test("keeps every filter in the url", async ({ page }) => {
  await page.goto("/charts");

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "Google Play" })
    .click();
  await pick(page, "Country", "DE · Germany");
  await pick(page, "Category", "Puzzle");
  await page
    .getByRole("tablist", { name: "Chart" })
    .getByRole("tab", { name: "Grossing" })
    .click();

  await expect(page).toHaveURL(/store=GOOGLE_PLAY/);
  await expect(page).toHaveURL(/country=de/);
  await expect(page).toHaveURL(/genre=GAME_PUZZLE/);
  await expect(page).toHaveURL(/collection=grossing/);
  await expect(page.getByRole("combobox", { name: "Device" })).toHaveCount(0);

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "App Store" })
    .click();

  await expect(page).not.toHaveURL(/genre=/);
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
  const device = page.getByRole("combobox", { name: "Device" });
  await expect(device).toHaveText("iPhone");
  await device.click();
  await expect(
    page.getByRole("option", { name: "iPad · not captured yet" }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("picks a captured day", async ({ page }) => {
  await page.goto("/charts");
  const oldest = TOP_CHART_DATES.at(-1) ?? "";
  const newest = TOP_CHART_DATES[0];

  await page.getByRole("button", { name: "Captured day", exact: true }).click();
  await expect(
    page.getByRole("button", { name: formatDay(newest) }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: formatDay(utcDaysAgo(3)) }),
  ).toBeDisabled();
  if (oldest.slice(0, 7) !== newest.slice(0, 7)) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
  await page.getByRole("button", { name: formatDay(oldest) }).click();

  await expect(page).toHaveURL(new RegExp(`date=${oldest}`));
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(oldest),
  );

  await page.getByRole("button", { name: "Next captured day" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${TOP_CHART_DATES.at(-2)}`));

  await page.goto(`/charts?date=${newest}`);
  await expect(
    page.getByRole("button", { name: "Next captured day" }),
  ).toBeDisabled();
});

test("shows the empty day and the uncaptured chart", async ({
  page,
  context,
}) => {
  await page.goto(`/charts?date=${utcDaysAgo(3)}`);
  await expect(
    page.getByText(`No capture of this chart on ${formatDay(utcDaysAgo(3))}`),
  ).toBeVisible();

  await context.addCookies([
    {
      name: "e2e_chart_uncaptured",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts");
  await expect(
    page.getByText("This chart has not been captured yet"),
  ).toBeVisible();
});

test("filters the rows in the browser", async ({ page }) => {
  await page.goto("/charts");

  await page
    .getByRole("textbox", { name: "Search apps" })
    .fill(TOP_CHART_APPS[2].title);

  await expect(chartTable(page).locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText(/1\s+of\s+10\s+apps/)).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(chartTable(page).locator("tbody tr")).toHaveCount(10);
});

test("is reachable from the sidebar and the palette", async ({ page }) => {
  await page.goto("/");

  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Top charts" });
  await link.click();
  await expect(page).toHaveURL(/\/charts$/);
  await expect(link).toHaveAttribute("aria-current", "page");

  await page.goto("/settings");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: "Top charts" }).click();
  await expect(page).toHaveURL(/\/charts$/);
});
