import { expect, test } from "./session.mts";

const LONG_TERM = "a".repeat(400);
const WIDTHS = [320, 375, 1440] as const;

const SEARCHES = [
  ["the keyword monitor", "/apps/app-1/keywords"],
  ["the metadata coverage table", "/apps/app-1/metadata"],
  ["the Action Center", "/actions"],
  ["the competitor comparison", "/apps/app-1/competitors"],
] as const;

for (const width of WIDTHS) {
  for (const [name, path] of SEARCHES) {
    test(`${name} keeps a long search term inside the page at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${path}?q=${LONG_TERM}`);

      const chips = page.getByRole("list", { name: "Active filters" });
      const chip = chips.getByRole("listitem").first();
      await expect(chip).toBeVisible();
      const remove = chips.getByRole("button", { name: /^Remove Search/ });
      await expect(remove).toBeVisible();

      const chipBox = await chip.boundingBox();
      const removeBox = await remove.boundingBox();
      expect(
        (chipBox?.x ?? 0) + (chipBox?.width ?? Infinity),
      ).toBeLessThanOrEqual(width);
      expect(
        (removeBox?.x ?? 0) + (removeBox?.width ?? Infinity),
      ).toBeLessThanOrEqual(width);
      expect(removeBox?.width ?? 0).toBeGreaterThanOrEqual(20);
      const badge = chip.locator('[data-slot="badge"]');
      expect((await badge.boundingBox())?.height ?? 0).toBeGreaterThan(24);
      expect(
        await badge.evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }
}

test("the remove button of a wrapped search chip clears the term", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/apps/app-1/keywords?q=${LONG_TERM}`);

  await page
    .getByRole("list", { name: "Active filters" })
    .getByRole("button", { name: /^Remove Search/ })
    .click();

  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(
    0,
  );
});

test("a short search chip keeps its one line height", async ({ page }) => {
  await page.goto("/apps/app-1/keywords?q=timer");

  const chip = page
    .getByRole("list", { name: "Active filters" })
    .getByRole("listitem")
    .first()
    .locator('[data-slot="badge"]');
  await expect(chip).toBeVisible();
  expect((await chip.boundingBox())?.height).toBeCloseTo(24, 0);
});
