import { expect, test } from "./session.mts";

const WIDTHS = [375, 768, 1440] as const;

const ROUTES = [
  ["app overview", "/apps/app-long"],
  ["keyword workspace", "/apps/app-long/keywords"],
  ["portfolio", "/"],
] as const;

async function overflowingElements(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const scrollsHorizontally = (node: HTMLElement) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowX);

    const insideScroller = (node: HTMLElement) => {
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (scrollsHorizontally(el)) return true;
      }
      return false;
    };

    const limit = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0) return false;
        if (box.right <= limit + 1 && box.left >= -1) return false;
        return !insideScroller(node);
      })
      .map((node) => `${node.tagName}.${node.className}`.slice(0, 120))
      .slice(0, 5);
  });
}

for (const width of WIDTHS) {
  for (const [name, path] of ROUTES) {
    test(`${name} contains long user strings at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        "the document must not scroll horizontally",
      ).toBe(true);

      expect(await overflowingElements(page)).toEqual([]);
    });
  }

  test(`the app title stays within two lines at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-long");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const lines = await heading.evaluate((node) => {
      const { lineHeight, fontSize } = getComputedStyle(node);
      const leading =
        lineHeight === "normal"
          ? Number.parseFloat(fontSize) * 1.2
          : Number.parseFloat(lineHeight);
      return Math.round(node.getBoundingClientRect().height / leading);
    });

    expect(lines).toBeLessThanOrEqual(2);
  });
}
