import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext } from "@playwright/test";
import { ESSENTIAL_ALERT_EVENTS } from "@asobeast/shared";
import { THEMES } from "./contrast-check.mts";
import { openSettledDialog } from "./dialog.mts";
import { ESSENTIAL_ALERT_COOKIE } from "./fixtures.mts";
import { expect, test } from "./session.mts";

const seedCookie = (context: BrowserContext, name: string) =>
  context.addCookies([{ name, value: "1", url: "http://localhost:3000" }]);

const essentialRow = (page: import("@playwright/test").Page) =>
  page
    .getByRole("list", { name: /email alerts/i })
    .getByRole("listitem")
    .filter({ hasText: "owner@example.com" })
    .first();

test("the essential alert carries its tag and its line", async ({
  page,
  context,
}) => {
  await seedCookie(context, ESSENTIAL_ALERT_COOKIE);
  await page.goto("/settings");
  const row = essentialRow(page);

  await expect(
    row.locator('[data-slot="badge"][data-variant="info"]'),
  ).toHaveText("Essential alerts");
  await expect(
    row.getByText(
      "Turned on by AsoBeast after your first daily run. Change the rules or stop them here.",
    ),
  ).toBeVisible();

  const dialog = await openSettledDialog(page, "Edit rules", row);
  for (const name of ["Rank dropped", "Review spike", "App delisted"]) {
    await expect(
      dialog.getByRole("switch", { name, exact: true }),
    ).toHaveAttribute("aria-checked", "true");
  }
  await expect(
    dialog.getByRole("textbox", { name: "Rank drop positions" }),
  ).toHaveValue("10");
});

test("the email card names what an https address turns on", async ({
  page,
  context,
}) => {
  await seedCookie(context, "e2e_https_needed");
  await page.goto("/settings");

  await expect(
    page.getByText(
      /turns on the essential alerts after your first daily run once/,
    ),
  ).toBeVisible();
  await expect(
    page.locator("code", { hasText: "WEB_PUBLIC_URL" }),
  ).toBeVisible();
});

test("the disabled hint says the essential alerts wait for email", async ({
  page,
  context,
}) => {
  await seedCookie(context, "e2e_smtp_off");
  await page.goto("/settings");

  await expect(page.getByText("Email alerts are disabled.")).toBeVisible();
  await expect(
    page.getByText(
      "Once email works, AsoBeast turns on the essential alerts for a new workspace after its first daily run.",
    ),
  ).toBeVisible();
});

test("a new email alert starts from the essential rules", async ({ page }) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add email alert");
  await page.getByLabel("Recipient email").fill("essential-start@example.com");
  const post = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/backend/email-alerts",
  );
  await dialog
    .getByRole("button", { name: "Add email alert", exact: true })
    .click();

  const body = (await post).postDataJSON() as {
    events: string[];
    rankDropThreshold?: number;
  };
  expect([...body.events].sort()).toEqual([...ESSENTIAL_ALERT_EVENTS].sort());
  expect(body.rankDropThreshold).toBe(10);
});

test("a new webhook keeps its single default rule", async ({ page }) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");

  await expect(dialog.getByRole("switch", { checked: true })).toHaveCount(1);
  await expect(
    dialog.getByRole("switch", { name: "Metadata changed", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

for (const theme of THEMES) {
  test(`the essential tag passes contrast in the ${theme} theme`, async ({
    page,
    context,
  }) => {
    await seedCookie(context, ESSENTIAL_ALERT_COOKIE);
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/settings");
    await expect(essentialRow(page)).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(violations).toEqual([]);
  });
}

test("the essential alert fits a 320px screen", async ({ page, context }) => {
  await seedCookie(context, ESSENTIAL_ALERT_COOKIE);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/settings");
  await expect(essentialRow(page)).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
