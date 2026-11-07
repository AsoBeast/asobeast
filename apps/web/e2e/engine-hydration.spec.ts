import { expectHydratesCleanly, settled } from "./page-errors.mts";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { SIGNED_IN_ROUTES, TRIAL_ROUTES, seedCookies } from "./routes.mts";
import { APP_EUR_ID, APP_HUF_ID, APP_JPY_ID } from "./fixtures.mts";

const AFFECTED_ROUTES = [
  ["settings", "/settings"],
  ["integrations", "/integrations"],
  ["action-center", "/actions"],
  ["app-actions", "/apps/app-1/actions"],
  ["admin-apps", "/admin/apps"],
  ["app-metadata-localization", "/apps/app-1/metadata?fieldLocale=es-MX"],
  ["top-charts-table", "/charts?view=table"],
  ["app-keyword-marks", "/apps/app-marks/keywords"],
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

test.describe("the opportunity map in this engine", () => {
  const MAP = "/apps/app-map/keywords?view=map";
  const dot = (page: Page, id: string) =>
    page.locator(`[data-map-keyword="${id}"]`);
  const activeDot = (page: Page) =>
    page.evaluate(
      () => document.activeElement?.getAttribute("data-map-keyword") ?? null,
    );
  const toggle = (page: Page, name: string) =>
    page
      .getByRole("list", { name: "Zones" })
      .getByRole("button", { name: new RegExp(`^${name} \\d+ keyword`) });

  test("hydrates without an uncaught error", async ({ page }) => {
    const errors = await settled(page, MAP);
    await expect(
      page.getByRole("region", { name: "Keyword opportunity map" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("one tab stop, arrows and Home and End", async ({ page }) => {
    await page.goto(MAP);
    await dot(page, "kw-map-3").waitFor();
    await expect(dot(page, "kw-map-3")).toHaveAttribute("tabindex", "0");
    await page
      .getByRole("list", { name: "Zones" })
      .getByRole("button", { name: "About Low priority" })
      .focus();
    await page.keyboard.press("Tab");
    expect(await activeDot(page)).toBe("kw-map-3");

    await dot(page, "kw-map-6").focus();
    await page.keyboard.press("ArrowRight");
    expect(await activeDot(page)).toBe("kw-map-13");
    await page.keyboard.press("End");
    expect(await activeDot(page)).toBe("kw-map-21");
    await page.keyboard.press("Home");
    expect(await activeDot(page)).toBe("kw-map-3");
  });

  test("focus survives a hover and the overlay follows focus", async ({
    page,
  }) => {
    await page.goto(MAP);
    await dot(page, "kw-map-1").focus();
    const overlay = page.locator('[data-slot="map-overlay"]');
    await expect(overlay).toContainText("focus timer");
    await expect(overlay).toContainText(/Position\s*3/);

    await dot(page, "kw-map-2").hover();
    await page.mouse.move(0, 0);
    expect(await activeDot(page)).toBe("kw-map-1");
  });

  test("Enter opens the history and Escape returns", async ({ page }) => {
    await page.goto(MAP);
    await dot(page, "kw-map-1").focus();
    await page.keyboard.press("Enter");
    const history = page.getByRole("dialog", {
      name: "Position history focus timer",
    });
    await expect(history).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(history).toHaveCount(0);
    await expect(dot(page, "kw-map-1")).toBeFocused();
  });

  test("shapes", async ({ page }) => {
    await page.goto("/apps/app-floor/keywords?view=map");
    await expect(page.locator('[data-shape="diamond"]')).toHaveCount(3);
    await expect(page.locator('[data-shape="circle"]')).toHaveCount(1);
  });

  test("thresholds", async ({ page }) => {
    await page.goto(MAP);
    await page.getByRole("button", { name: "Thresholds" }).click();
    const dialog = page.getByRole("dialog", { name: "Zone thresholds" });
    const popularity = dialog.getByRole("spinbutton", {
      name: "Popularity at least",
    });

    await popularity.fill("30");
    await expect(toggle(page, "Quick wins")).toHaveAccessibleName(
      "Quick wins 6 keywords",
    );
    await popularity.fill("150");
    await expect(popularity).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("alert")).toHaveText(
      "Enter a whole number from 0 to 100",
    );
    await dialog.getByRole("button", { name: "Reset" }).click();
    await expect(toggle(page, "Quick wins")).toHaveAccessibleName(
      "Quick wins 8 keywords",
    );
  });

  test("the zone area click", async ({ page }) => {
    await page.goto(MAP);
    await dot(page, "kw-map-1").click();
    await expect(page).not.toHaveURL(/zone=/);
    await page.keyboard.press("Escape");

    const box = await page.locator(".zone-quickWins").first().boundingBox();
    if (!box) throw new Error("no quick wins area");
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.125);
    await expect(page).toHaveURL(/zone=quickWins/);
  });
});
