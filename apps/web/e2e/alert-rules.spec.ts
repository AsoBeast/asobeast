import { randomUUID } from "node:crypto";
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

async function setRule(
  dialog: Locator,
  name: string,
  on: boolean,
): Promise<void> {
  const rule = ruleSwitch(dialog, name);
  if ((await rule.getAttribute("aria-checked")) !== String(on)) {
    await rule.click();
  }
  await expect(rule).toHaveAttribute("aria-checked", String(on));
}

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
  const rule = ruleSwitch(dialog, "Weekly digest");

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
  expect(body.events).toContain("digest.weekly");
});

test("the stars show under New review only while it is on", async ({
  page,
}) => {
  const dialog = await openAddEmailAlert(page);
  const stars = dialog.getByRole("group", { name: "New review stars" });
  await expect(stars).toHaveCount(0);

  await setRule(dialog, "New review", true);
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

  await setRule(dialog, "New review", false);
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

const rankField = (dialog: Locator) =>
  dialog.getByRole("textbox", { name: "Rank drop positions" });

const CHANNELS = [
  {
    trigger: "Add email alert",
    field: "Recipient email",
    target: (tag: string) => `rank-${tag}-${randomUUID()}@example.com`,
    refused: "alerts@localhost",
    path: "/api/backend/email-alerts",
  },
  {
    trigger: "Add webhook",
    field: "Endpoint URL",
    target: (tag: string) =>
      `https://hooks.example.com/rank-${tag}-${randomUUID()}`,
    refused: "ftp://hooks.example.com",
    path: "/api/backend/webhooks",
  },
] as const;

for (const channel of CHANNELS) {
  test(`${channel.trigger} sets the rank drop positions inline`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    await setRule(dialog, "Rank dropped", false);
    await expect(rankField(dialog)).toHaveCount(0);

    await setRule(dialog, "Rank dropped", true);
    await rankField(dialog).fill("");
    await expect(rankField(dialog)).toHaveAttribute("placeholder", "5");
    await expect(rankField(dialog)).toHaveAccessibleDescription(
      "Leave empty to use the instance value, 5. A smaller value counts as 5, the lowest value this instance detects.",
    );
    await setRule(dialog, "Rank improved", true);
    await expect(dialog.getByText("Uses the rank drop value.")).toBeVisible();

    await rankField(dialog).fill("10");
    const target = channel.target("inline");
    await page.getByLabel(channel.field).fill(target);
    const post = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === channel.path,
    );
    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();

    expect((await post).postDataJSON()).toMatchObject({
      rankDropThreshold: 10,
    });
    const row = page.getByRole("listitem").filter({ hasText: target }).first();
    await expect(
      row.locator('[data-slot="badge"]').filter({ hasText: "Rank dropped" }),
    ).toHaveText("Rank dropped · 10+");
  });

  test(`${channel.trigger} sends no rank drop positions when the field is empty`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    await setRule(dialog, "Rank dropped", true);
    await rankField(dialog).fill("");
    await page.getByLabel(channel.field).fill(channel.target("empty"));
    const post = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === channel.path,
    );
    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();

    expect((await post).postDataJSON()).not.toHaveProperty("rankDropThreshold");
  });

  test(`${channel.trigger} refuses rank drop positions out of range`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    await setRule(dialog, "Rank dropped", true);
    let posted = false;
    page.on("request", (request) => {
      if (request.method() === "POST") posted = true;
    });

    for (const text of ["0", "201"]) {
      await rankField(dialog).fill(text);
      await expect(rankField(dialog)).toHaveAttribute("aria-invalid", "true");
      await expect(rankField(dialog)).toBeFocused();
      await expect(
        dialog.getByText("Enter a whole number from 1 to 200").first(),
      ).toBeVisible();
    }
    await page.getByLabel(channel.field).fill(channel.target("range"));
    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();
    await expect(dialog).toBeVisible();
    expect(posted).toBe(false);
  });

  test(`${channel.trigger} marks only the field a refusal names`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    const target = page.getByLabel(channel.field);
    const submit = dialog.getByRole("button", {
      name: channel.trigger,
      exact: true,
    });
    await setRule(dialog, "Rank dropped", true);
    await rankField(dialog).fill("0");
    await target.fill(channel.target("named"));
    await submit.click();

    await expect(
      dialog.getByText("Enter a whole number from 1 to 200").first(),
    ).toBeVisible();
    await expect(target).not.toHaveAttribute("aria-invalid", "true");

    await rankField(dialog).fill("10");
    await target.fill(channel.refused);
    await submit.click();
    await expect(target).toHaveAttribute("aria-invalid", "true");
  });
}

test("the essential alert reopens on its positions and clears them", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e-essential-alert", value: "1", url: "http://localhost:3000" },
  ]);
  await page.goto("/settings");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "owner@example.com" })
    .first();
  await expect(
    row.locator('[data-slot="badge"]').filter({ hasText: "Rank dropped" }),
  ).toHaveText("Rank dropped · 10+");
  const dialog = await openSettledDialog(page, "Edit rules", row);
  await expect(rankField(dialog)).toHaveValue("10");

  await rankField(dialog).fill("");
  const patch = page.waitForRequest((request) => request.method() === "PATCH");
  await dialog.getByRole("button", { name: "Save rules" }).click();

  expect((await patch).postDataJSON()).toMatchObject({
    rankDropThreshold: null,
  });
});

for (const width of [320, 390]) {
  test(`the rank drop field fits under its rule at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const dialog = await openAddEmailAlert(page);
    await setRule(dialog, "Rank dropped", true);

    await expect(rankField(dialog)).toBeVisible();
    await expectFitsViewport(page, dialog);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
