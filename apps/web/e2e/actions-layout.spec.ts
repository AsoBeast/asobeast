import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

async function railBeside(page: Page): Promise<boolean> {
  const queue = await page.locator("#queue").boundingBox();
  const progress = await page
    .getByRole("heading", { name: "Progress", level: 2 })
    .boundingBox();
  if (!queue || !progress) throw new Error("layout not rendered");
  return progress.x >= queue.x + queue.width;
}

test("the rail sits beside the queue on a wide page and below it on a narrow one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/actions");
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  expect(await railBeside(page)).toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(() => railBeside(page)).toBe(false);
});

test("collapsing the sidebar gives the rail room beside the queue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/actions");
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  expect(await railBeside(page)).toBe(false);

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

  await expect.poll(() => railBeside(page)).toBe(true);
});

test("the queue and the progress rail each have a section heading", async ({
  page,
}) => {
  await page.goto("/actions");

  await expect(
    page.getByRole("heading", { name: "Queue", level: 2 }),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText(/confirmed fixed in 30 days/)).toBeVisible();
});

test("the rail shows the open work by app and filters to it", async ({
  page,
}) => {
  await page.goto("/actions");
  const where = page
    .getByRole("heading", { name: "Where the work is" })
    .locator("xpath=..");
  const focus = where.getByRole("link", { name: /Focus Timer · US/ });

  await expect(focus).toContainText("10");
  await focus.click();

  await expect(page).toHaveURL(/app=app-1/);
  await expect(page.locator("[id='action-act-gp-defend']")).toHaveCount(0);
  await expect(page.locator("[id='action-act-uncovered']")).toBeVisible();
});

test("an app's rail shows the open work by market", async ({ page }) => {
  await page.goto("/apps/app-1/actions");

  const where = page
    .getByRole("heading", { name: "Where the work is" })
    .locator("xpath=..");
  await expect(where.getByRole("link", { name: /Germany/ })).toBeVisible();
  await expect(
    where.getByRole("link", { name: /United States/ }),
  ).toBeVisible();
});

const holdActivity = async (page: Page) => {
  const token = randomUUID();
  await page
    .context()
    .addCookies([
      { name: "e2e_activity_hold", value: token, url: "http://localhost:3000" },
    ]);
  return () =>
    page
      .context()
      .request.post(`${MOCK_API_URL}/__activity-holds/${token}/release`);
};

test("the queue stays put when the tiles stream in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const release = await holdActivity(page);
  await page.goto("/actions", { waitUntil: "commit" });

  await expect(
    page.locator('[data-slot="stat-tile-skeleton"]').first(),
  ).toBeVisible();
  const before = (await page.locator("#queue").boundingBox())!.y;

  await release();
  await expect(page.locator('[data-slot="stat-tile"]').first()).toBeVisible();
  const after = (await page.locator("#queue").boundingBox())!.y;

  expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
});

for (const [width, rows] of [
  [1440, 1],
  [375, 2],
] as const) {
  test(`the tile skeletons form ${rows} row${rows > 1 ? "s" : ""} at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await holdActivity(page);
    await page.goto("/actions", { waitUntil: "commit" });

    const tiles = page.locator('[data-slot="stat-tile-skeleton"]');
    await expect(tiles).toHaveCount(4);
    const tops = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(rows);
  });
}
