import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import { THEMES } from "./contrast-check.mts";
import { expectFitsViewport, openSettledDialog } from "./dialog.mts";
import { expect, test } from "./session.mts";

const GROUPS = [
  "Rankings",
  "Charts",
  "Reviews and ratings",
  "Listings",
  "Reports",
];

const rules = (dialog: Locator) =>
  dialog.getByRole("group", { name: "Alert rules" });

const ruleSwitch = (dialog: Locator, name: string) =>
  rules(dialog).getByRole("switch", { name, exact: true });

async function openAddEmailAlert(page: Page): Promise<Locator> {
  await page.goto("/settings");
  return openSettledDialog(page, "Add email alert");
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`the rules list groups every rule with its sentence at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const dialog = await openAddEmailAlert(page);

    for (const group of GROUPS) {
      await expect(
        rules(dialog).getByRole("group", { name: group }),
      ).toHaveCount(1);
    }
    await expect(rules(dialog).getByRole("switch")).toHaveCount(
      WEBHOOK_EVENTS.length,
    );
    await expect(
      ruleSwitch(dialog, "Rank dropped"),
    ).toHaveAccessibleDescription(
      "A keyword of your app falls by at least this many positions.",
    );
    await expectFitsViewport(page, dialog);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("a rule switched on from the keyboard is saved", async ({ page }) => {
  const dialog = await openAddEmailAlert(page);
  const rule = ruleSwitch(dialog, "Review spike");

  await rule.focus();
  await page.keyboard.press("Space");
  await expect(rule).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("Recipient email").fill("rules-keyboard@example.com");
  const post = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/backend/email-alerts",
  );
  await dialog
    .getByRole("button", { name: "Add email alert", exact: true })
    .click();
  const body = (await post).postDataJSON() as { events: string[] };
  expect(body.events).toContain("review.spike");
});

test("the stars show under New review only while it is on", async ({
  page,
}) => {
  const dialog = await openAddEmailAlert(page);
  const stars = dialog.getByRole("group", { name: "New review stars" });
  await expect(stars).toHaveCount(0);

  await ruleSwitch(dialog, "New review").click();
  await expect(stars).toBeVisible();
  for (const star of await stars.getByRole("checkbox").all()) {
    await star.click();
  }
  await expect(dialog.getByText("Pick at least one star.")).toBeVisible();
  await page.getByLabel("Recipient email").fill("rules-stars@example.com");
  await dialog
    .getByRole("button", { name: "Add email alert", exact: true })
    .click();
  await expect(
    dialog.getByText("Pick at least one star", { exact: true }),
  ).toBeVisible();

  await ruleSwitch(dialog, "New review").click();
  await expect(stars).toHaveCount(0);
});

for (const theme of THEMES) {
  test(`the rules list passes axe in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    const dialog = await openAddEmailAlert(page);
    await expect(rules(dialog)).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withRules([
        "color-contrast",
        "aria-allowed-attr",
        "aria-valid-attr-value",
        "aria-required-children",
        "label",
        "list",
        "listitem",
      ])
      .analyze();
    expect(violations).toEqual([]);
  });
}
