import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { openSettledDialog } from "./dialog.mts";

const SELECTED_ATTRIBUTE = "aria-checked";
const SERP_ENTRANT = "SERP entrant";
const EDIT_EVENTS = "Edit events";
const RANK_MILESTONE = "Rank milestone";

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;

const CHANNELS = [
  {
    trigger: "Add email alert",
    field: "Recipient email",
    target: () => `alerts-${randomUUID()}@example.com`,
    list: "/api/backend/email-alerts",
  },
  {
    trigger: "Add webhook",
    field: "Endpoint URL",
    target: () => `https://hooks.example.com/${randomUUID()}`,
    list: "/api/backend/webhooks",
  },
] as const;

function eventOptions(dialog: Locator): Locator {
  return dialog.getByRole("group", { name: "Events" }).getByRole("checkbox");
}

function eventOption(dialog: Locator, name: string): Locator {
  return dialog.getByRole("checkbox", { name, exact: true });
}

async function setSelected(option: Locator, selected: boolean): Promise<void> {
  if ((await option.getAttribute(SELECTED_ATTRIBUTE)) !== String(selected)) {
    await option.click();
  }
  await expect(option).toHaveAttribute(SELECTED_ATTRIBUTE, String(selected));
}

async function createChannel(
  page: Page,
  channel: (typeof CHANNELS)[number],
): Promise<Locator> {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, channel.trigger);
  for (const option of await eventOptions(dialog).all()) {
    await setSelected(option, false);
  }
  await setSelected(eventOption(dialog, SERP_ENTRANT), true);
  const target = channel.target();
  await page.getByLabel(channel.field).fill(target);
  await dialog
    .getByRole("button", { name: channel.trigger, exact: true })
    .click();
  const row = page.getByRole("listitem").filter({ hasText: target });
  await expect(row.locator('[data-slot="badge"]')).toHaveText([SERP_ENTRANT]);
  return row;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no layout box");
  return box;
}

function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function expectSameBox(actual: Box, expected: Box, message: string): void {
  expect(actual.x, message).toBeCloseTo(expected.x, 1);
  expect(actual.y, message).toBeCloseTo(expected.y, 1);
  expect(actual.width, message).toBeCloseTo(expected.width, 1);
  expect(actual.height, message).toBeCloseTo(expected.height, 1);
}

test("the rank events sit together among the event chips", async ({ page }) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");

  await expect(eventOptions(dialog)).toHaveText([
    "Metadata changed",
    "Rank dropped",
    "Rank improved",
    "Rank milestone",
    "First ranking",
    "Overtaken by competitor",
    "Negative review",
    "Weekly digest",
    "SERP entrant",
    "New action",
  ]);
});

for (const channel of CHANNELS) {
  test(`${channel.trigger} edits the events of an existing channel`, async ({
    page,
  }) => {
    const row = await createChannel(page, channel);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(eventOption(dialog, SERP_ENTRANT)).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "true",
    );
    await setSelected(eventOption(dialog, RANK_MILESTONE), true);

    const patch = page.waitForRequest(
      (request) => request.method() === "PATCH",
    );
    await dialog.getByRole("button", { name: "Save events" }).click();

    expect((await patch).postDataJSON()).toEqual({
      events: ["serp.entrant", "rank.milestone"],
    });
    await expect(dialog).toBeHidden();
    await expect(row.locator('[data-slot="badge"]')).toHaveText([
      SERP_ENTRANT,
      RANK_MILESTONE,
    ]);
  });

  test(`${channel.trigger} reopens a saved edit before the list refetches`, async ({
    page,
  }) => {
    const row = await createChannel(page, channel);
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
    await setSelected(eventOption(dialog, RANK_MILESTONE), true);
    await dialog.getByRole("button", { name: "Save events" }).click();
    await expect(dialog).toBeHidden();

    const reopened = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(eventOption(reopened, RANK_MILESTONE)).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "true",
    );
  });

  test(`${channel.trigger} keeps the edit open when saving fails`, async ({
    page,
  }) => {
    const row = await createChannel(page, channel);
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
    await setSelected(eventOption(dialog, RANK_MILESTONE), true);

    await dialog.getByRole("button", { name: "Save events" }).click();

    await expect(page.getByText(/Could not save the .* events/)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(eventOption(dialog, RANK_MILESTONE)).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "true",
    );
  });

  test(`${channel.trigger} cannot save a channel without events`, async ({
    page,
  }) => {
    const row = await createChannel(page, channel);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);

    await setSelected(eventOption(dialog, SERP_ENTRANT), false);

    await expect(
      dialog.getByRole("button", { name: "Save events" }),
    ).toBeDisabled();
    await expect(
      dialog.getByText("Select at least one event to save."),
    ).toBeVisible();
  });

  test(`${channel.trigger} discards an edit closed with Escape`, async ({
    page,
  }) => {
    const row = await createChannel(page, channel);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await setSelected(eventOption(dialog, RANK_MILESTONE), true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(row.locator('[data-slot="badge"]')).toHaveText([SERP_ENTRANT]);

    const reopened = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(eventOption(reopened, RANK_MILESTONE)).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "false",
    );
  });

  test(`${channel.trigger} selects and deselects every event`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);

    const options = eventOptions(dialog);
    await expect(options).toHaveCount(WEBHOOK_EVENTS.length);

    for (let index = 0; index < WEBHOOK_EVENTS.length; index += 1) {
      const option = options.nth(index);
      await setSelected(option, true);
      await setSelected(option, false);
    }

    await setSelected(eventOption(dialog, SERP_ENTRANT), true);
  });

  test(`${channel.trigger} saves exactly the events chosen`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);

    for (const option of await eventOptions(dialog).all()) {
      await setSelected(option, false);
    }

    const chosen = [
      eventOption(dialog, SERP_ENTRANT),
      eventOptions(dialog).first(),
    ];
    const labels: string[] = [];
    for (const option of chosen) {
      await setSelected(option, true);
      labels.push((await option.innerText()).trim());
    }

    const target = channel.target();
    await page.getByLabel(channel.field).fill(target);
    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();

    const row = page.getByRole("listitem").filter({ hasText: target });
    await expect(row.locator('[data-slot="badge"]')).toHaveText(labels);
  });

  test(`${channel.trigger} exposes the events as a labelled group`, async ({
    page,
  }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);

    const group = dialog.getByRole("group", { name: "Events" });
    await expect(group.getByRole("checkbox")).toHaveCount(
      WEBHOOK_EVENTS.length,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`${channel.trigger} keeps the group still while ${SERP_ENTRANT} is pressed at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/settings");
      const dialog = await openSettledDialog(page, channel.trigger);

      const group = dialog.getByRole("group", { name: "Events" });
      const option = eventOption(dialog, SERP_ENTRANT);
      const optionBox = await boxOf(option);
      const groupBox = await boxOf(group);
      const center = centerOf(optionBox);

      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      const pressedBox = await boxOf(option);
      await page.mouse.up();

      expectSameBox(
        pressedBox,
        optionBox,
        "the toggle must not move under the pointer",
      );

      await expect(option).toHaveAttribute(SELECTED_ATTRIBUTE, "true");
      expectSameBox(
        await boxOf(option),
        optionBox,
        "the toggle must not move once selected",
      );
      expectSameBox(
        await boxOf(group),
        groupBox,
        "the group must not reflow once selected",
      );
    });
  }
}
