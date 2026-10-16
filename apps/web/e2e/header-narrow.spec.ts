import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { HEALTH, HEALTH_DEGRADED } from "./fixtures.mts";

const PHONE_WIDTHS = [320, 375] as const;

const ROUTES = [
  ["overview", "/apps/app-1"],
  ["keywords", "/apps/app-1/keywords"],
  ["audit", "/apps/app-1/audit"],
  ["long title", "/apps/app-long"],
] as const;

const STATES = [
  ["healthy", HEALTH, "api"],
  ["degraded", HEALTH_DEGRADED, "degraded"],
] as const;

const answerHealth = (page: Page, body: unknown) =>
  page.route("**/api/backend/health", (route) => route.fulfill({ json: body }));

const expectFits = async (page: Page, width: number) => {
  const account = page
    .getByRole("banner")
    .getByRole("button", { name: "Account menu" });
  await expect(account).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  const box = await account.boundingBox();
  expect((box?.x ?? Infinity) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
};

for (const width of PHONE_WIDTHS) {
  for (const [route, path] of ROUTES) {
    for (const [state, body, label] of STATES) {
      test(`${route} fits at ${width} px while health is ${state}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 812 });
        await answerHealth(page, body);
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        await expect(
          page.getByRole("banner").getByText(label, { exact: true }),
        ).toBeAttached();
        await expectFits(page, width);
      });
    }
  }

  test(`unreachable fits at ${width} px and has its own mark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.route("**/api/backend/health", (route) => route.abort());
    await page.goto("/apps/app-1/keywords");
    const header = page.getByRole("banner");

    await expect(header.getByText("unreachable", { exact: true })).toBeAttached(
      { timeout: 15_000 },
    );
    await expectFits(page, width);
    await expect(header.locator("svg.lucide-circle-x")).toHaveCount(1);
    await expect(header.locator("svg.lucide-triangle-alert")).toHaveCount(0);
  });
}

test("shows the health words from 640 px", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await answerHealth(page, HEALTH_DEGRADED);
  await page.goto("/apps/app-1/keywords");

  await expect(
    page.getByRole("banner").getByText("degraded", { exact: true }),
  ).toBeVisible();
});

test("marks degraded and healthy differently without the words", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await answerHealth(page, HEALTH);
  await page.goto("/apps/app-1/keywords");
  const header = page.getByRole("banner");
  await expect(header.getByText("api", { exact: true })).toBeAttached();
  await expect(header.locator("svg.lucide-triangle-alert")).toHaveCount(0);

  await page.unrouteAll();
  await answerHealth(page, HEALTH_DEGRADED);
  await page.reload();
  await expect(header.getByText("degraded", { exact: true })).toBeAttached();
  await expect(header.locator("svg.lucide-triangle-alert")).toHaveCount(1);
});
