import { readFileSync } from "node:fs";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";

test("rankings page renders the chart and filters series through the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  await expect(chart).toBeVisible();
  await expect(
    chart.getByRole("list", { name: "Charted series" }).getByRole("listitem"),
  ).toHaveText([
    "focus timer (US)",
    "pomodoro (US)",
    "study timer (US)",
    "productivity app (US)",
    "time blocking (US)",
  ]);

  await expect(page.getByRole("button", { name: "5 selected" })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove focus timer (US) from the chart" })
    .click();

  await expect(page).toHaveURL(/keywords=/);
  await expect(page.getByRole("button", { name: "4 selected" })).toBeVisible();
});

test("a range preset writes to the url", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page
    .getByRole("tablist", { name: "Date range" })
    .getByRole("tab", { name: "7d" })
    .click();

  await expect(page).toHaveURL(/range=7d/);
});

test("the serp movers card lists entrants with badges and a track action", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  await expect(page.getByText(/New entrants in your keywords/)).toBeVisible();

  const competitorRow = page
    .getByRole("listitem")
    .filter({ hasText: "Rival Focus" });
  await expect(competitorRow.getByText("Competitor")).toBeVisible();
  await expect(competitorRow).toContainText("entered the top 10 for");
  await expect(competitorRow).toContainText("at #4");

  const unknownRow = page
    .getByRole("listitem")
    .filter({ hasText: "Newcomer Timer" });
  await expect(unknownRow.getByRole("button", { name: "Track" })).toBeVisible();

  await page.getByRole("tab", { name: "14d" }).click();
  await expect(page).toHaveURL(/movers=14/);
});

test("the ranking tooltip shows each captured-depth marker", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  await hoverForTooltip(page, chart, page.getByText(">100").first());

  const box = await chart.boundingBox();
  if (!box) throw new Error("Ranking chart is not visible");
  await hoverForTooltip(page, chart, page.getByText(">200").first(), {
    x: box.width * 0.85,
    y: box.height / 2,
  });
});

test("the ranking chart takes keyboard focus and announces positions", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const chart = page.getByRole("region", { name: "Keyword rank positions" });
  const plot = chart.getByRole("application");

  await plot.focus();
  await expect(plot).toBeFocused();

  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("focus timer");

  const before = await tooltip.innerText();
  await plot.press("ArrowRight");

  await expect.poll(async () => await tooltip.innerText()).not.toBe(before);
  await expect(tooltip).toContainText("focus timer");
});

test("ranking exports preserve historical captured-depth markers", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export rankings to CSV" }).click();
  const download = await downloadPromise;
  const path = await download.path();

  expect(path).not.toBeNull();
  if (path === null) throw new Error("Ranking export did not produce a file");
  const csv = readFileSync(path, "utf8");
  expect(csv).toContain(">100");
  expect(csv).toContain(">200");
});
