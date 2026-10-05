import type { Page } from "@playwright/test";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const WIDTHS = [360, 375, 700, 767, 768, 769, 820, 1024, 1280] as const;

const LISTINGS = [
  ["french play listing", "/apps/app-fr/metadata"],
  ["hebrew play listing", "/apps/app-he/metadata"],
  ["arabic play listing", "/apps/app-ar/metadata"],
  ["long app store listing", "/apps/app-long/metadata"],
] as const;

const SIDEBARS = [
  ["open", {}],
  ["collapsed", { sidebar_state: "false" }],
] as const;

const FIELD_GRID = "#main-content section.grid";

for (const [sidebar, cookies] of SIDEBARS) {
  for (const width of WIDTHS) {
    for (const [name, path] of LISTINGS) {
      test(`the ${name} stays inside the page at ${width} with the sidebar ${sidebar}`, async ({
        page,
        context,
      }) => {
        await seedCookies(context, cookies);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const spilling = await page
          .locator(`${FIELD_GRID} > *`)
          .evaluateAll((cards) =>
            cards
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
  return page
    .locator(`${FIELD_GRID} > *`)
    .evaluateAll(
      (cards) =>
        new Set(
          cards.map((card) => Math.round(card.getBoundingClientRect().left)),
        ).size,
    );
};

test("the listing fields stack while the content beside the open sidebar is narrow", async ({
  page,
}) => {
  expect(await columnsAt(page, 768, {})).toBe(1);
});

test("the listing fields pair up once the content box is wide enough", async ({
  page,
}) => {
  expect(await columnsAt(page, 1280, {})).toBe(2);
});

test("the listing fields pair up beside a collapsed sidebar at a tablet width", async ({
  page,
}) => {
  expect(await columnsAt(page, 820, { sidebar_state: "false" })).toBe(2);
});

for (const width of [375, 768, 1024]) {
  test(`a draft keeps its lint rows inside its card at ${width}`, async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_metadata_ai: "1" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-long/metadata");
    await page.getByRole("button", { name: "Generate drafts" }).click();

    const copies = page.getByRole("button", { name: /^Copy .+ draft$/ });
    await expect(copies).toHaveCount(3);

    const spilling = await copies.evaluateAll((buttons) =>
      buttons.flatMap((button) => {
        const card = button.closest<HTMLElement>(".rounded-xl");
        return card && card.scrollWidth <= card.clientWidth
          ? []
          : [button.getAttribute("aria-label")];
      }),
    );
    expect(spilling).toEqual([]);
  });
}
