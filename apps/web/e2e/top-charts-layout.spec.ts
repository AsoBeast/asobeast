import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const trendingPanel = (page: Page) =>
  page.getByRole("complementary", { name: "Trending" });

async function trendingBeside(page: Page): Promise<boolean> {
  const table = await page.getByRole("table").boundingBox();
  const panel = await trendingPanel(page).boundingBox();
  if (!table || !panel) throw new Error("layout not rendered");
  return panel.x > table.x && panel.y < table.y + table.height;
}

async function panelTop(page: Page): Promise<number> {
  const panel = await trendingPanel(page).boundingBox();
  if (!panel) throw new Error("panel not rendered");
  return panel.y;
}

test("the trending panel sits beside the table on a laptop and below it on a tablet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/charts?view=table");
  await expect(trendingPanel(page)).toBeVisible();
  expect(await trendingBeside(page)).toBe(true);

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect.poll(() => trendingBeside(page)).toBe(false);
});

test("the trending panel stays in view while the table scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/charts?view=table");
  await expect(trendingPanel(page)).toBeVisible();
  const before = await panelTop(page);

  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(before - 56);

  const top = await panelTop(page);
  expect(top).toBeGreaterThanOrEqual(56);
  expect(top).toBeLessThanOrEqual(120);
});

test("the trending list tabs fit inside the side panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/charts?view=table");
  const panel = await trendingPanel(page).boundingBox();
  const tabs = await trendingPanel(page)
    .getByRole("tablist", { name: "Trending list" })
    .getByRole("tab")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    );

  expect(tabs).toHaveLength(4);
  for (const right of tabs) {
    expect(right).toBeLessThanOrEqual((panel?.x ?? 0) + (panel?.width ?? 0));
  }
});
