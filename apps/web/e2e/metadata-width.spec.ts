import type { Page } from "@playwright/test";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const WIDTHS = [360, 375, 700, 767, 768, 769, 820, 1024, 1280] as const;

const LISTINGS = [
  ["french play listing", "/apps/app-fr/metadata", 3],
  ["hebrew play listing", "/apps/app-he/metadata", 3],
  ["arabic play listing", "/apps/app-ar/metadata", 3],
  ["long app store listing", "/apps/app-long/metadata", 4],
] as const;

const SIDEBARS = [
  ["open", {}, WIDTHS],
  [
    "collapsed",
    { sidebar_state: "false" },
    WIDTHS.filter((width) => width >= 768),
  ],
] as const;

const FIELD_GRID = "#main-content section.grid";

for (const [sidebar, cookies, widths] of SIDEBARS) {
  for (const width of widths) {
    for (const [name, path, cards] of LISTINGS) {
      test(`the ${name} stays inside the page at ${width} with the sidebar ${sidebar}`, async ({
        page,
        context,
      }) => {
        await seedCookies(context, cookies);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        const fields = page.locator(`${FIELD_GRID} > *`);
        await expect(fields).toHaveCount(cards);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const spilling = await fields.evaluateAll((elements) =>
          elements
            .filter((card) => card.scrollWidth > card.clientWidth)
            .map((card) => card.querySelector("span")?.textContent),
        );
        expect(spilling).toEqual([]);
      });
    }
  }
}

const columnsAt = async (
  page: Page,
  width: number,
  cookies: Readonly<Record<string, string>>,
) => {
  await seedCookies(page.context(), cookies);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/apps/app-fr/metadata");
  const fields = page.locator(`${FIELD_GRID} > *`);
  await expect(fields).toHaveCount(3);
  return fields.evaluateAll(
    (elements) =>
      new Set(
        elements.map((card) => Math.round(card.getBoundingClientRect().left)),
      ).size,
  );
};

test("the listing fields stack while the content beside the open sidebar is narrow", async ({
  page,
}) => {
  expect(await columnsAt(page, 768, {})).toBe(1);
});

test("the listing fields pair up beside the open sidebar once the content box is wide enough", async ({
  page,
}) => {
  expect(await columnsAt(page, 1024, {})).toBe(2);
});

test("the listing fields pair up beside a collapsed sidebar at a tablet width", async ({
  page,
}) => {
  expect(await columnsAt(page, 820, { sidebar_state: "false" })).toBe(2);
});
