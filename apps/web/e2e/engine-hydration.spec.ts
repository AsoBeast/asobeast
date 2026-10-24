import { expectHydratesCleanly, settled } from "./page-errors.mts";
import { expect, test } from "./session.mts";
import { SIGNED_IN_ROUTES, TRIAL_ROUTES, seedCookies } from "./routes.mts";
import { APP_EUR_ID, APP_HUF_ID, APP_JPY_ID } from "./fixtures.mts";

const AFFECTED_ROUTES = [
  ["settings", "/settings"],
  ["action-center", "/actions"],
  ["app-actions", "/apps/app-1/actions"],
  ["admin-apps", "/admin/apps"],
  ["app-metadata-localization", "/apps/app-1/metadata?fieldLocale=es-MX"],
  ["top-charts-table", "/charts?view=table"],
] as const;

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} hydrates without an uncaught error in this engine`, async ({
    page,
  }) => {
    await expectHydratesCleanly(page, name, path);
  });
}

for (const [name, path, cookies] of TRIAL_ROUTES) {
  test(`${name} hydrates without an uncaught error in this engine`, async ({
    page,
    context,
  }) => {
    await seedCookies(context, cookies);
    await expectHydratesCleanly(page, name, path);
  });
}

test("a collapsed competitors page hydrates without an uncaught error in this engine", async ({
  page,
  context,
}) => {
  await seedCookies(context, {
    asobeast_collapsed: "competitors.discovery%2Ccompetitors.matrix",
  });
  await expectHydratesCleanly(
    page,
    "app-competitors-collapsed",
    "/apps/app-1/competitors",
  );
});

test("an open keyword breakdown hydrates without an uncaught error in this engine", async ({
  page,
}) => {
  const errors = await settled(page, "/apps/app-1/competitors?keyword=kw-2");

  await expect(
    page.getByRole("dialog", { name: "Why apps rank for this keyword" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the settings budget sentence words the date and time the same on both sides", async ({
  page,
}) => {
  const errors = await settled(page, "/settings");

  await expect(
    page.getByText("The next run starts Jul 31, 2026, 3:00 AM UTC"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the admin app table names a storefront the same on both sides", async ({
  page,
}) => {
  const errors = await settled(page, "/admin/apps");

  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Ana Habits" })
      .getByRole("cell", { name: "China", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a price in euros is worded the same on both sides", async ({ page }) => {
  const errors = await settled(page, `/apps/${APP_EUR_ID}`);

  await expect(page.getByText("€4.99", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a price in forints is worded the same on both sides", async ({
  page,
}) => {
  const errors = await settled(page, `/apps/${APP_HUF_ID}`);

  await expect(page.getByText("HUF 1,490", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the changes timeline words a price in zloty the same on both sides", async ({
  page,
}) => {
  const errors = await settled(page, `/apps/${APP_JPY_ID}/changes`);

  await expect(page.getByText("PLN 9.99").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe("on a phone in Japan", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });

  for (const [name, path] of AFFECTED_ROUTES) {
    test(`${name} hydrates without an uncaught error`, async ({ page }) => {
      const errors = await settled(page, path);

      expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual(
        [],
      );
    });
  }
});
