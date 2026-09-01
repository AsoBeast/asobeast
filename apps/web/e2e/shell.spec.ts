import { version } from "../package.json";
import { expect, test } from "./session.mts";
import { SIGNED_IN_ROUTES } from "./routes.mts";

const DESKTOP_WIDTHS = [768, 1024, 1440] as const;

test("the sidebar stays off canvas until the trigger opens it at 375", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const documentation = page.getByRole("link", { name: "Documentation" });
  await expect(documentation).toBeHidden();

  const trigger = page.getByRole("button", { name: "Toggle Sidebar" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(documentation).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(documentation).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the active section carries aria-current in the sidebar", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const sections = page.getByRole("navigation", { name: "App sections" });
  await expect(
    sections.getByRole("link", { name: "Keywords", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sections.locator('[aria-current="page"]')).toHaveCount(1);
});

for (const width of DESKTOP_WIDTHS) {
  test(`the sidebar collapses to icons and keeps its labels at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const sidebar = page.locator("[data-slot=sidebar]");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect(
      page.getByRole("link", { name: "Documentation" }),
    ).toBeVisible();

    await page.keyboard.press("ControlOrMeta+b");
    await expect(sidebar).toHaveAttribute("data-collapsible", "icon");
    await expect(
      page.getByRole("link", { name: "Documentation" }),
    ).toBeVisible();
  });
}

test("an empty portfolio turns the switcher into an import affordance", async ({
  page,
}) => {
  await page.route("**/api/backend/apps", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );

  await page.goto("/");

  const sidebar = page.getByRole("navigation", { name: "Main" });
  await expect(
    sidebar.getByRole("button", { name: "Import app" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Choose an app/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "App sections" }),
  ).toHaveCount(0);
});

test("the sidebar footer names the version the build shipped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const footer = page
    .getByRole("navigation", { name: "Main" })
    .getByText(`v${version}`);
  await expect(footer).toBeVisible();

  await page.keyboard.press("ControlOrMeta+b");
  await expect(footer).toBeHidden();
});

test("the collapsed sidebar survives a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+b");

  await page.goto("/settings");

  await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
    "data-state",
    "collapsed",
  );
});

for (const width of [375, ...DESKTOP_WIDTHS] as const) {
  test(`no route scrolls horizontally at ${width}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });

    for (const [name, path] of SIGNED_IN_ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const fits = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(fits, `${name} scrolls horizontally at ${width}`).toBe(true);
    }
  });
}

test("the shell declares its colour scheme and safe-area gutters", async ({
  page,
}) => {
  await page.goto("/");

  const scheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(["light", "dark"]).toContain(scheme);

  const gutter = await page
    .getByRole("main")
    .evaluate((node) => getComputedStyle(node).paddingLeft);
  expect(Number.parseFloat(gutter)).toBeGreaterThanOrEqual(16);
});
