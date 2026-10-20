import type { Page } from "@playwright/test";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/competitors";
const DISCOVERY = "Apps you don’t track yet";
const COLLAPSED_COOKIE = "asobeast_collapsed";
const HEIGHT_TOLERANCE = 64;

const collapsed = (id: string) => ({
  [COLLAPSED_COOKIE]: encodeURIComponent(id),
});

async function trackDiscoverySlot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const heights: number[] = [];
    Object.assign(window, { discoveryHeights: heights });
    const slot = () => {
      const root = document.querySelector<HTMLElement>(".page-full");
      const column = root?.matches(".flex-col")
        ? root
        : root?.firstElementChild;
      return column?.children[1] ?? null;
    };
    const sample = () => {
      const height = Math.round(slot()?.getBoundingClientRect().height ?? 0);
      if (height > 0 && heights.at(-1) !== height) heights.push(height);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

const discoveryHeights = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { discoveryHeights: number[] }).discoveryHeights,
  );

async function expectSteadyDiscoveryHeight(page: Page): Promise<void> {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: DISCOVERY, exact: true }),
  ).toBeVisible();

  const heights = await discoveryHeights(page);
  const settled = heights.at(-1) ?? 0;
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) {
    expect(
      Math.abs(height - settled),
      `the card was ${height}px tall and settled at ${settled}px (${heights.join(", ")})`,
    ).toBeLessThanOrEqual(HEIGHT_TOLERANCE);
  }
}

test("the discovery card keeps its height while the page streams in, open", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_api_latency: "1500" });
  await trackDiscoverySlot(page);

  await expectSteadyDiscoveryHeight(page);
});

test("opening a collapsed section still animates", async ({
  page,
  context,
}) => {
  await seedCookies(context, collapsed("competitors.discovery"));
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: DISCOVERY, exact: true }).click();

  const content = page
    .getByRole("region", { name: DISCOVERY })
    .locator("[data-slot=collapsible-content]");
  await expect
    .poll(() =>
      content.evaluate((node) => getComputedStyle(node).animationName),
    )
    .toBe("collapsible-down");
});
