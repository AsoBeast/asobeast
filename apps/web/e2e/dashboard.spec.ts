import { expect, test } from "./session.mts";

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
  await expect(page.getByText("Changes this week")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(0);
});

test("an app awaiting its first run says so instead of showing zeros", async ({
  page,
}) => {
  await page.goto("/");

  const card = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByText("Pending App", { exact: true }) });

  await expect(card).toHaveCount(1);
  await expect(card.getByText(/Awaiting the first daily run/)).toBeVisible();
  await expect(card.getByText("0", { exact: true })).toHaveCount(0);
});

test("the sparkline end marker stays round however wide the card is", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const marker = page.locator('[data-slot="sparkline-end"]').first();
  await expect(marker).toBeVisible();

  const box = await marker.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  expect(box.height).toBeGreaterThan(0);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
});

test("the summary tile numbers stay on one line when the strip narrows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(5);
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

  await expect(page.getByText("Changes this week")).toBeVisible();
  await expect(
    page.getByText("metadata updates in the last 7 days"),
  ).toBeVisible();
  await expect(page.getByText("Open actions", { exact: true })).toBeVisible();
});
