import { expect, test } from "./session.mts";
import { startedSetup } from "./setup-session.mts";

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
  await expect(page.getByText("Listing changes in 7 days")).toHaveCount(0);
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
  await page.goto("/");

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

test("an app in setup carries a progress chip that opens its setup", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/");

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

  for (const label of [
    "Keywords in top 10",
    "Moved in 7 days",
    "Open actions",
    "Listing changes in 7 days",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/by competitors/)).toBeVisible();
  await expect(
    page.getByText(/^\d+ started ranking · \d+ dropped out$/),
  ).toBeVisible();
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

  const tile = page
    .getByText("Open actions", { exact: true })
    .locator("xpath=..");
  await expect(tile).toContainText("—");
  await expect(tile).toContainText("Not generated yet");
});

test("the top 10 trend sits level with its figure", async ({ page }) => {
  await page.goto("/");

  const value = page
    .locator('[data-slot="stat-tile"]')
    .filter({ hasText: "Keywords in top 10" })
    .locator(":scope > span")
    .nth(1);
  await expect(value).toContainText("7d");

  const offset = await value.evaluate((node) => {
    const figure = node.querySelector(":scope > span > span:first-child")!;
    const chip = node.querySelector(":scope > span > span:last-child")!;
    const middle = (box: DOMRect) => box.top + box.height / 2;
    return Math.abs(
      middle(figure.getBoundingClientRect()) -
        middle(chip.getBoundingClientRect()),
    );
  });

  expect(offset).toBeLessThanOrEqual(2);
});
