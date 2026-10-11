import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const VISIBILITY_GUIDE = "https://docs.asobeast.com/concepts/visibility";

const openHelp = async (page: Page, scope: Locator) => {
  await scope.getByRole("button", { name: "About visibility" }).click();
  const help = page.getByRole("dialog", {
    name: "How visibility is calculated",
  });
  await expect(help).toBeVisible();
  return help;
};

const settled = (help: Locator) =>
  help.evaluate((node) =>
    Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ).then(() => undefined),
  );

const statCard = (page: Page) =>
  page.locator('[data-slot="card"]').filter({ hasText: "Visibility" }).first();

test("the overview explains how visibility is calculated", async ({ page }) => {
  await page.goto("/apps/app-1");

  const help = await openHelp(page, statCard(page));

  await expect(help).toHaveAccessibleDescription(
    "How close the app is to ranking first for every keyword it tracks. 100 means position 1 for all of them, 0 means none was found.",
  );
  await expect(help.getByRole("row")).toHaveText([
    "PositionCounts",
    "1100%",
    "350%",
    "1029%",
    "5018%",
    "10015%",
    ">2000%",
  ]);
  await expect(help).toContainText("counts as popularity 10");
  await expect(
    help.getByRole("link", { name: "Read the full calculation" }),
  ).toHaveAttribute("href", VISIBILITY_GUIDE);
});

test("escape closes the explanation and returns focus to its button", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const trigger = statCard(page).getByRole("button", {
    name: "About visibility",
  });

  const help = await openHelp(page, statCard(page));
  await page.keyboard.press("Escape");

  await expect(help).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("the explanation has no accessibility violation", async ({ page }) => {
  await page.goto("/apps/app-1");
  const help = await openHelp(page, statCard(page));
  await settled(help);

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();

  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
});

test("the explanation fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/apps/app-1");

  const help = await openHelp(page, statCard(page));
  await settled(help);
  const box = await help.boundingBox();

  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(16);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375 - 16);
});
