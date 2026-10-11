import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
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

for (const theme of THEMES) {
  test(`the explanation has no accessibility violation in the ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme });
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
}

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

for (const view of ["cards", "table"]) {
  test(`the dashboard explains visibility in the ${view} view`, async ({
    page,
  }) => {
    await page.goto(`/?view=${view}`);
    const apps = page.getByRole("region", { name: "Apps" });

    await openHelp(page, apps);

    await expect(page).toHaveURL(new RegExp(`view=${view}`));
  });
}

test("the change impact card says which keywords and popularity its visibility uses", async ({
  page,
}) => {
  await page.goto("/apps/app-1/changes");
  const card = page.getByRole("region", {
    name: "How rankings moved after each change",
  });

  const help = await openHelp(page, card);

  await expect(help).toContainText(
    "Here visibility covers only this market's keywords checked on both days, each weighted by its popularity on the last check before the change, so only positions move it.",
  );
});
