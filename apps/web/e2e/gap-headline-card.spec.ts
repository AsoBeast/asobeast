import type { Page } from "@playwright/test";
import { FAIL_ANALYSIS_COOKIE, GAP_STATE_COOKIE } from "./fixtures.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const card = (page: Page) =>
  page.getByRole("region", { name: "Gaps against your competitors" });

const sentence = (page: Page) => card(page).locator("p");

test("sums up the winnable gaps and threats in one sentence", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  await expect(sentence(page)).toHaveText(
    "2 winnable gaps. Biggest: productivity app, Rival Focus ranks #8, you are not ranked. 2 threats.",
  );
  expect(await sentence(page).evaluate((node) => node.childNodes.length)).toBe(
    1,
  );
});

test("links the biggest gap to its breakdown on the competitors page", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const link = card(page).getByRole("link", { name: "See the winnable gaps" });

  await expect(link).toHaveAttribute(
    "href",
    "/apps/app-1/competitors?gaps=winnable&keyword=kw-4",
  );
  await link.click();

  await expect(page).toHaveURL(/\/apps\/app-1\/competitors\?gaps=winnable/);
  await expect(
    page.getByRole("dialog", { name: "Why apps rank for this keyword" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("tab", { name: "Winnable now (2)" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("counts the market the overview looks at", async ({ page }) => {
  await page.goto("/apps/app-1?market=pl");
  await expect(sentence(page)).toHaveText(
    "Your competitors have not been checked yet.",
  );
});

test("invites a competitor when the app has none", async ({ page }) => {
  await page.goto("/apps/app-2");

  await expect(sentence(page)).toHaveText("Add a competitor to see gaps.");
  await expect(
    card(page).getByRole("link", { name: "Add a competitor" }),
  ).toHaveAttribute("href", "/apps/app-2/competitors#competitor-search");
});

for (const [state, text] of [
  ["all-delisted", "Every competitor you track is delisted."],
  ["nothing-to-win", "No winnable gaps or threats right now."],
] as const) {
  test(`says so when ${state}`, async ({ page, context }) => {
    await seedCookies(context, { [GAP_STATE_COOKIE]: state });
    await page.goto("/apps/app-1");

    await expect(sentence(page)).toHaveText(text);
    await expect(card(page).getByRole("link")).toHaveCount(0);
  });
}

test("keeps the overview when the analysis fails", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await seedCookies(context, { [FAIL_ANALYSIS_COOKIE]: "1" });
  await page.goto("/apps/app-1");

  await expect(card(page)).toContainText(
    "The gap summary could not be loaded.",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Focus Timer" }).first(),
  ).toBeVisible();

  await context.clearCookies({ name: FAIL_ANALYSIS_COOKIE });
  await card(page).getByRole("button", { name: "Retry" }).click();
  await expect(sentence(page)).toContainText("2 winnable gaps.");
});

for (const width of [320, 375]) {
  test(`wraps the sentence on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/apps/app-1");
    await expect(sentence(page)).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
}
