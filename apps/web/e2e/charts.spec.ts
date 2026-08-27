import { expect, test } from "./session.mts";

test("rank series are distinguishable without colour", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");
  await page.waitForLoadState("networkidle");

  const region = page.getByRole("region", { name: "Keyword rank positions" });
  await expect(region).toBeVisible();

  const patterns = await region
    .locator(".recharts-line-curve")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getAttribute("stroke") !== "transparent")
        .map((node) => node.getAttribute("stroke-dasharray") ?? "solid"),
    );

  expect(patterns.length).toBeGreaterThan(1);
  expect(new Set(patterns).size).toBe(patterns.length);
});

test("the rank legend carries the stroke pattern, not only a colour", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");
  await page.waitForLoadState("networkidle");

  const legend = page.getByRole("list", { name: "Charted series" }).first();
  const swatches = await legend
    .locator("svg line")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("stroke-dasharray") ?? "solid"),
    );

  expect(swatches.length).toBeGreaterThan(1);
  expect(new Set(swatches).size).toBe(swatches.length);
});

test("the rank chart shades the bands that matter in aso", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");
  await page.waitForLoadState("networkidle");

  const region = page.getByRole("region", { name: "Keyword rank positions" });
  await expect(region.locator(".recharts-reference-area-rect")).toHaveCount(3);

  const labels = await region
    .locator(".recharts-label")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent));
  expect(labels).toEqual(expect.arrayContaining(["Top 3", "Top 10", "Top 25"]));
});

test("a checked but unranked day renders a marker, not a gap", async ({
  page,
}) => {
  await page.goto("/apps/app-1/rankings");
  await page.waitForLoadState("networkidle");

  const region = page.getByRole("region", { name: "Keyword rank positions" });
  const markers = region.locator(
    ".recharts-line-dots circle[fill='var(--background)']",
  );

  expect(await markers.count()).toBeGreaterThan(0);
});

test("a chart with no points explains itself instead of drawing axes", async ({
  page,
}) => {
  await page.goto("/apps/app-2");

  await expect(page.getByText("No visibility recorded yet")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Search visibility over time" }),
  ).toHaveCount(0);
});

test("a chart with too few points renders the value, not a trend", async ({
  page,
}) => {
  await page.goto("/apps/app-long");

  await expect(page.getByText("Latest visibility")).toBeVisible();
  await expect(page.getByText("44", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Search visibility over time" }),
  ).toHaveCount(0);
});

test("rankings distinguish no keywords from no captures", async ({ page }) => {
  await page.goto("/apps/app-2/rankings");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("No keywords tracked yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to keywords" }),
  ).toBeVisible();
});

test("rankings offer a wider range when the window is empty", async ({
  page,
}) => {
  await page.goto("/apps/app-long/rankings?range=7d");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Nothing captured in this range")).toBeVisible();
  await page.getByRole("button", { name: "Widen to 90 days" }).click();

  await expect(page).toHaveURL(/range=90d/);
  await expect(page.getByText("Nothing captured in this range")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Widen to 90 days" }),
  ).toHaveCount(0);
});
