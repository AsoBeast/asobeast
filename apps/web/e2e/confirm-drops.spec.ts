import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { expectFitsViewport, openSettledDialog } from "./dialog.mts";

const LABEL = "Confirm drops before alerting";
const BADGE = "Confirmed drops";
const EDIT_EVENTS = "Edit events";
const SERP_ENTRANT = "SERP entrant";
const RANK_MILESTONE = "Rank milestone";

const CHANNELS = [
  {
    trigger: "Add email alert",
    field: "Recipient email",
    target: () => `drops-${randomUUID()}@example.com`,
    list: "/api/backend/email-alerts",
    startsTicked: true,
  },
  {
    trigger: "Add webhook",
    field: "Endpoint URL",
    target: () => `https://hooks.example.com/${randomUUID()}`,
    list: "/api/backend/webhooks",
    startsTicked: false,
  },
] as const;

type Channel = (typeof CHANNELS)[number];

function confirmDrops(dialog: Locator): Locator {
  return dialog.getByRole("checkbox", { name: LABEL });
}

function badges(row: Locator): Locator {
  return row.locator('[data-slot="badge"]');
}

async function createChannel(
  page: Page,
  channel: Channel,
  confirming: boolean,
): Promise<{ row: Locator; body: unknown }> {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, channel.trigger);
  await confirmDrops(dialog).setChecked(confirming);
  const target = channel.target();
  await page.getByLabel(channel.field).fill(target);
  const post = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === channel.list,
  );
  await dialog
    .getByRole("button", { name: channel.trigger, exact: true })
    .click();
  const body = (await post).postDataJSON() as unknown;
  await expect(dialog).toBeHidden();
  return { row: page.getByRole("listitem").filter({ hasText: target }), body };
}

async function savedPatch(page: Page, dialog: Locator): Promise<unknown> {
  const patch = page.waitForRequest((request) => request.method() === "PATCH");
  await dialog.getByRole("button", { name: "Save events" }).click();
  return (await patch).postDataJSON() as unknown;
}

for (const channel of CHANNELS) {
  test(`${channel.trigger} starts with its default and sends it`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    await expect(confirmDrops(dialog)).toBeChecked({
      checked: channel.startsTicked,
    });
    const target = channel.target();
    await page.getByLabel(channel.field).fill(target);
    const post = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === channel.list,
    );
    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();

    expect((await post).postDataJSON()).toMatchObject({
      confirmDrops: channel.startsTicked,
    });
  });

  test(`${channel.trigger} creates a channel that reports every drop when unticked`, async ({
    page,
  }) => {
    const { row, body } = await createChannel(page, channel, false);

    expect(body).toMatchObject({ confirmDrops: false });
    await expect(badges(row)).toHaveText(["Metadata changed"]);
  });

  test(`${channel.trigger} creates a confirming channel when ticked`, async ({
    page,
  }) => {
    const { row, body } = await createChannel(page, channel, true);

    expect(body).toMatchObject({ confirmDrops: true });
    await expect(badges(row)).toHaveText([BADGE, "Metadata changed"]);
  });

  test(`${channel.trigger} names and describes the setting outside the events`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);

    await expect(confirmDrops(dialog)).toHaveAccessibleDescription(
      /slips from #9 to #11 and comes back sends nothing/,
    );
    await expect(
      dialog.getByRole("group", { name: "Events" }).getByRole("checkbox"),
    ).toHaveCount(WEBHOOK_EVENTS.length);
  });

  test(`${channel.trigger} toggles the setting with Space`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    const box = confirmDrops(dialog);

    await box.focus();
    await page.keyboard.press("Space");
    await expect(box).toBeChecked({ checked: !channel.startsTicked });
    await page.keyboard.press("Space");
    await expect(box).toBeChecked({ checked: channel.startsTicked });
  });

  test(`${channel.trigger} turns the setting on and off from Edit events`, async ({
    page,
  }) => {
    const { row } = await createChannel(page, channel, false);

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await confirmDrops(dialog).click();
    expect(await savedPatch(page, dialog)).toEqual({
      events: ["metadata.changed"],
      confirmDrops: true,
    });
    await expect(dialog).toBeHidden();
    await expect(badges(row)).toHaveText([BADGE, "Metadata changed"]);

    const again = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(confirmDrops(again)).toBeChecked();
    await confirmDrops(again).click();
    expect(await savedPatch(page, again)).toEqual({
      events: ["metadata.changed"],
      confirmDrops: false,
    });
    await expect(again).toBeHidden();
    await expect(badges(row)).toHaveText(["Metadata changed"]);
  });

  test(`${channel.trigger} sends no setting when only the events change`, async ({
    page,
  }) => {
    const { row } = await createChannel(page, channel, true);

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await dialog.getByRole("checkbox", { name: SERP_ENTRANT }).click();

    expect(await savedPatch(page, dialog)).toEqual({
      events: ["metadata.changed", "serp.entrant"],
    });
  });

  test(`${channel.trigger} reopens a saved setting before the list refetches`, async ({
    page,
  }) => {
    const { row } = await createChannel(page, channel, false);
    await page.route(
      (url) => url.pathname === channel.list,
      async (route) => {
        if (route.request().method() === "GET") {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
        await route.continue();
      },
    );

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await confirmDrops(dialog).click();
    await dialog.getByRole("button", { name: "Save events" }).click();
    await expect(dialog).toBeHidden();

    const reopened = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(confirmDrops(reopened)).toBeChecked();
  });

  test(`${channel.trigger} discards a setting closed with Escape`, async ({
    page,
  }) => {
    const { row } = await createChannel(page, channel, false);
    let patched = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH") patched = true;
    });

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await confirmDrops(dialog).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(badges(row)).toHaveText(["Metadata changed"]);

    const reopened = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(confirmDrops(reopened)).not.toBeChecked();
    expect(patched).toBe(false);
  });

  test(`${channel.trigger} keeps the dialog and the tick when saving fails`, async ({
    page,
  }) => {
    const { row } = await createChannel(page, channel, false);
    await page.route(
      (url) => url.pathname.startsWith(`${channel.list}/`),
      (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ statusCode: 500, message: "boom" }),
            })
          : route.continue(),
    );

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await confirmDrops(dialog).click();
    await dialog.getByRole("button", { name: "Save events" }).click();

    await expect(page.getByText(/Could not save the .* events/)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(confirmDrops(dialog)).toBeChecked();
  });

  test(`${channel.trigger} passes axe in both themes`, async ({ page }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/settings");
      await openSettledDialog(page, channel.trigger);

      const { violations } = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withRules([
          "aria-valid-attr-value",
          "aria-prohibited-attr",
          "color-contrast",
          "label",
          "list",
          "listitem",
        ])
        .analyze();
      expect(violations.map(({ id }) => id)).toEqual([]);
    }
  });

  test(`${channel.trigger} fits a narrow screen with the help line`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);

    await expect(confirmDrops(dialog)).toBeVisible();
    await expectFitsViewport(page, dialog);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("the edit dialog marks the setting of a confirming row", async ({
  page,
}) => {
  const { row } = await createChannel(page, CHANNELS[1], true);

  const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
  await expect(confirmDrops(dialog)).toBeChecked();
  await dialog.getByRole("checkbox", { name: RANK_MILESTONE }).click();

  expect(await savedPatch(page, dialog)).toEqual({
    events: ["metadata.changed", "rank.milestone"],
  });
  await expect(badges(row)).toHaveText([
    BADGE,
    "Metadata changed",
    RANK_MILESTONE,
  ]);
});

test("Add webhook ticks the setting for a chat url and unticks it for a json endpoint", async ({
  page,
}) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");
  const field = page.getByLabel("Endpoint URL");

  await field.fill("https://discord.com/api/webhooks/1/abc");
  await expect(confirmDrops(dialog)).toBeChecked();
  await field.fill("https://hooks.example.com/asobeast");
  await expect(confirmDrops(dialog)).not.toBeChecked();
  await field.fill("https://hooks.slack.com/services/T1/B2/x");
  await expect(confirmDrops(dialog)).toBeChecked();
});

test("Add webhook keeps a choice made by hand when the url changes", async ({
  page,
}) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");
  const field = page.getByLabel("Endpoint URL");

  await field.fill("https://discord.com/api/webhooks/1/abc");
  await confirmDrops(dialog).click();
  await field.fill("https://discord.com/api/webhooks/2/def");
  await expect(confirmDrops(dialog)).not.toBeChecked();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const reopened = await openSettledDialog(page, "Add webhook");
  await page
    .getByLabel("Endpoint URL")
    .fill("https://discord.com/api/webhooks/1/abc");
  await expect(confirmDrops(reopened)).toBeChecked();
});
