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
    "Keyword movement",
    "Open actions",
    "Changes this week",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/by competitors/)).toBeVisible();
  await expect(page.getByText(/lost in 7 days/)).toBeVisible();
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
  await expect(tile).toContainText("not generated yet");
});

test("the top 10 trend sits level with the rest of its note", async ({
  page,
}) => {
  await page.goto("/");

  const note = page
    .locator('[data-slot="stat-tile"]')
    .filter({ hasText: "Keywords in top 10" })
    .locator(":scope > span")
    .nth(2);
  await expect(note).toContainText("tracked");

  const offset = await note.evaluate((node) => {
    const chip = node.querySelector(".numeric")!.getBoundingClientRect();
    const text = document.createRange();
    const words = [...node.querySelectorAll("*"), node]
      .flatMap((el) => [...el.childNodes])
      .find(
        (child) =>
          child.nodeType === 3 && child.textContent!.includes("tracked"),
      )!;
    text.selectNodeContents(words);
    const box = text.getBoundingClientRect();
    return Math.abs(chip.top + chip.height / 2 - (box.top + box.height / 2));
  });

  expect(offset).toBeLessThanOrEqual(1);
});
