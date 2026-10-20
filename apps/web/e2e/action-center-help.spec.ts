import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { expect, test } from "./session.mts";

const GUIDE = "https://docs.asobeast.com/guides/action-center";

const PAGES = [
  ["the Action Center", "/actions"],
  ["an app's Actions tab", "/apps/app-1/actions"],
] as const;

const helpButton = (page: Page) =>
  page.getByRole("button", { name: /how actions are generated/i });

const helpDialog = (page: Page) =>
  page.getByRole("dialog", { name: "How actions are generated", exact: true });

for (const [name, path] of PAGES) {
  test(`${name} explains how actions are generated on click`, async ({
    page,
  }) => {
    await page.goto(path);

    await helpButton(page).click();

    const help = helpDialog(page);
    await expect(help).toBeVisible();
    await expect(help).toHaveAccessibleDescription(
      /computed deterministically from your stored data/,
    );
    await expect(
      help.getByRole("link", { name: "Read how the Action Center works" }),
    ).toHaveAttribute("href", GUIDE);
  });

  test.describe(`${name} on a touch screen`, () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 800 } });

    test("a tap opens the explanation and a second tap closes it", async ({
      page,
    }) => {
      await page.goto(path);
      const button = helpButton(page);

      await button.tap();

      const help = helpDialog(page);
      await expect(help).toBeVisible();
      await expect(help).toContainText("computed deterministically");
      await expect(button).toHaveAttribute("aria-expanded", "true");

      await button.tap();
      await expect(help).toBeHidden();
    });
  });
}

test("escape closes the explanation and returns focus to its button", async ({
  page,
}) => {
  await page.goto("/actions");
  const button = helpButton(page);

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(helpDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(helpDialog(page)).toBeHidden();
  await expect(button).toBeFocused();
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
    await page.goto("/actions");
    await helpButton(page).click();
    await expect(helpDialog(page)).toBeVisible();
    await helpDialog(page).evaluate((node) =>
      Promise.all(
        node
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      ).then(() => undefined),
    );

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
