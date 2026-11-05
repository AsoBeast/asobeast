import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { seedChecklist } from "./workspace-checklist.mts";

const PILL_NAME = /done in the setup checklist$/;

const pill = (page: Page) => page.getByRole("button", { name: PILL_NAME });
const popover = (page: Page) =>
  page.getByRole("dialog", { name: "Setup checklist" });
const steps = (page: Page) =>
  popover(page).getByRole("list", { name: "Checklist steps" });
const row = (page: Page, title: string) =>
  steps(page).getByRole("listitem").filter({ hasText: title });

async function openPill(page: Page, path = "/apps/app-1"): Promise<void> {
  await page.goto(path);
  await (await hydrated(pill(page))).click();
  await expect(popover(page)).toBeVisible();
}

const pillWidth = async (page: Page) =>
  (await pill(page).boundingBox())?.width ?? 0;

const overflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("the pill stays hidden without a scenario", async ({ page }) => {
  await page.goto("/apps/app-1");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await expect(pill(page)).toHaveCount(0);
});

test("the pill names its progress and floats at the bottom right", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");

  const button = await hydrated(
    page.getByRole("button", {
      name: "2 of 8 done in the setup checklist",
      exact: true,
    }),
  );
  await expect(button).toContainText("2 of 8 done");
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(viewport.width - (box.x + box.width)).toBeLessThanOrEqual(32);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  const container = button.locator(
    "xpath=ancestor::div[contains(@class,'fixed')][1]",
  );
  await expect(container).toHaveCSS("position", "fixed");
});

test("the popover lists the steps in order with the next one marked", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  const items = steps(page).getByRole("listitem");
  await expect(items).toHaveCount(8);
  await expect(items.first()).toContainText("Import an app");
  await expect(row(page, "Import an app")).toContainText("Done");
  await expect(row(page, "Add a competitor")).toContainText("Done");
  await expect(row(page, "Track keywords in a second market")).toContainText(
    "Next",
  );
  await expect(steps(page).getByText("Next", { exact: true })).toHaveCount(1);
});

test("each open step links to the page that does it", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await expect(
    popover(page).getByRole("link", { name: "Add a market" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords");
  await expect(
    popover(page).getByRole("link", { name: "Connect a console" }),
  ).toHaveAttribute("href", "/integrations#store-connections");
  await expect(
    popover(page).getByRole("link", { name: "Open reviews" }),
  ).toHaveAttribute(
    "href",
    "/apps/app-1/reviews?replyState=needs_reply&sort=lowest",
  );

  await popover(page).getByRole("link", { name: "Add a market" }).click();
  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await expect(popover(page)).toHaveCount(0);
});

test("the keyboard opens and closes the popover on the pill", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.closest('[role="dialog"]') !== null &&
          document.activeElement !== document.body,
      ),
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("a fresh workspace asks for an app first", async ({ page, context }) => {
  await seedChecklist(context, "fresh");
  await openPill(page);

  await expect(pill(page)).toHaveAccessibleName(
    "0 of 7 done in the setup checklist",
  );
  await expect(row(page, "Add a competitor")).toContainText(
    "Import an app first",
  );
  await expect(row(page, "Add a competitor").getByRole("link")).toHaveCount(0);
  await expect(
    popover(page).getByRole("link", { name: "Import an app" }),
  ).toHaveAttribute("href", "/");
});

test("a complete checklist shows no pill", async ({ page, context }) => {
  await seedChecklist(context, "complete");
  await page.goto("/apps/app-1");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await expect(pill(page)).toHaveCount(0);
});

for (const [scenario, missing] of [
  ["play-only", "Fill your keyword field"],
  ["no-console", "Connect a store console"],
  ["no-reviews", "Reply to a review"],
] as const) {
  test(`${scenario} leaves out ${missing}`, async ({ page, context }) => {
    await seedChecklist(context, scenario);
    await openPill(page);

    await expect(steps(page).getByRole("listitem")).toHaveCount(7);
    await expect(row(page, missing)).toHaveCount(0);
    await expect(pill(page)).toHaveAccessibleName(/ of 7 done/);
  });
}

test("the pill shrinks, remembers it and expands again", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await popover(page).getByRole("button", { name: "Shrink the pill" }).click();
  await expect.poll(() => pillWidth(page)).toBeLessThanOrEqual(40);
  await expect(pill(page)).toHaveAccessibleName(
    "2 of 8 done in the setup checklist",
  );

  await page.reload();
  await expect(await hydrated(pill(page))).toBeVisible();
  await expect.poll(() => pillWidth(page)).toBeLessThanOrEqual(40);

  await pill(page).click();
  await popover(page).getByRole("button", { name: "Expand the pill" }).click();
  await expect.poll(() => pillWidth(page)).toBeGreaterThan(80);
});

test("the pill announces nothing at load", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  const status = button.locator(
    "xpath=ancestor::div[contains(@class,'fixed')][1]//*[@role='status']",
  );
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText("");
});

for (const width of [320, 375]) {
  test(`the pill and its popover fit at ${width} px`, async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await page.setViewportSize({ width, height: 740 });
    await openPill(page);

    expect(await overflows(page)).toBe(false);
    const box = await popover(page).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }

    await popover(page)
      .getByRole("button", { name: "Shrink the pill" })
      .click();
    await page.keyboard.press("Escape");
    expect(await overflows(page)).toBe(false);
  });
}

test("the pill is left out of print", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  await page.emulateMedia({ media: "print" });
  await expect(button).toBeHidden();
});

for (const theme of THEMES) {
  test(`the open popover has no contrast violation in the ${theme} theme`, async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await openPill(page);

    const { violations } = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(violations.flatMap(({ nodes }) => nodes)).toEqual([]);
  });
}

test("the bulk bar stays above the pill", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1/keywords");
  await hydrated(pill(page));

  await page
    .getByRole("checkbox", { name: /^Select / })
    .first()
    .check();
  await page
    .getByRole("group", { name: "Bulk keyword actions" })
    .getByRole("button", { name: "Tag", exact: true })
    .click();

  await expect(
    page.getByRole("dialog", { name: "Tag keywords" }),
  ).toBeVisible();
});
