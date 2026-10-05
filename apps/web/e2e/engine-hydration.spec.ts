import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { SIGNED_IN_ROUTES } from "./routes.mts";

const AFFECTED_ROUTES = [
  ["settings", "/settings"],
  ["action-center", "/actions"],
  ["app-actions", "/apps/app-1/actions"],
  ["admin-apps", "/admin/apps"],
] as const;

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function settled(page: Page, path: string) {
  const errors = collectPageErrors(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return errors;
}

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} hydrates without an uncaught error in this engine`, async ({
    page,
  }) => {
    const errors = await settled(page, path);

    expect(new URL(page.url()).pathname, `${name} redirected away`).toBe(path);
    expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual([]);
  });
}

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
    page.getByRole("row").filter({ hasText: "Ana Habits" }),
  ).toContainText("China");
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
