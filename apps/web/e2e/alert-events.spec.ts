import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { expectFitsViewport, openSettledDialog } from "./dialog.mts";

const SELECTED_ATTRIBUTE = "aria-checked";
const SERP_ENTRANT = "SERP entrant";
const EDIT_EVENTS = "Edit events";
const RANK_MILESTONE = "Rank milestone";
const NEW_REVIEW = "New review";
const STAR_LABELS = ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"];
const CHART_ENTERED = "Chart entered";
const CHART_MILESTONE = "Chart milestone";

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

function starGroup(dialog: Locator): Locator {
  return dialog.getByRole("group", { name: "New review stars" });
}

function starOption(dialog: Locator, name: string): Locator {
  return starGroup(dialog).getByRole("checkbox", { name, exact: true });
}

async function pickStars(dialog: Locator, picked: string[]): Promise<void> {
  for (const label of STAR_LABELS) {
    await setSelected(starOption(dialog, label), picked.includes(label));
  }
}

async function openWithEvents(
  page: Page,
  channel: (typeof CHANNELS)[number],
  events: string[],
): Promise<Locator> {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, channel.trigger);
  for (const option of await eventOptions(dialog).all()) {
    await setSelected(option, false);
  }
  for (const event of events) {
    await setSelected(eventOption(dialog, event), true);
  }
  return dialog;
}

async function submitChannel(
  page: Page,
  channel: (typeof CHANNELS)[number],
  dialog: Locator,
): Promise<{ row: Locator; body: Record<string, unknown> }> {
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
  const body = (await post).postDataJSON() as Record<string, unknown>;
  await expect(dialog).toBeHidden();
  return { row: page.getByRole("listitem").filter({ hasText: target }), body };
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

test("the event chips follow the order of the contract", async ({ page }) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");

  await expect(eventOptions(dialog)).toHaveText([
    "Metadata changed",
    "Rank dropped",
    "Rank improved",
    "Rank milestone",
    "First ranking",
    "Overtaken by competitor",
    "New review",
    "Negative review",
    "Weekly digest",
    "SERP entrant",
    "New action",
    "Chart entered",
    "Chart left",
    "Chart milestone",
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

  test(`${channel.trigger} saves the chart events`, async ({ page }) => {
    await page.goto("/settings");
    const dialog = await openSettledDialog(page, channel.trigger);
    for (const option of await eventOptions(dialog).all()) {
      await setSelected(option, false);
    }
    await setSelected(eventOption(dialog, CHART_ENTERED), true);
    await setSelected(eventOption(dialog, CHART_MILESTONE), true);

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

    expect((await post).postDataJSON().events).toEqual([
      "chart.entered",
      "chart.milestone",
    ]);
    const row = page.getByRole("listitem").filter({ hasText: target });
    await expect(row.locator('[data-slot="badge"]')).toHaveText([
      CHART_ENTERED,
      CHART_MILESTONE,
    ]);
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

  test(`${channel.trigger} shows the stars only while New review is ticked`, async ({
    page,
  }) => {
    const dialog = await openWithEvents(page, channel, [SERP_ENTRANT]);
    await expect(starGroup(dialog)).toHaveCount(0);

    await setSelected(eventOption(dialog, NEW_REVIEW), true);
    await expect(starGroup(dialog).getByRole("checkbox")).toHaveText(
      STAR_LABELS,
    );
    for (const label of STAR_LABELS) {
      await expect(starOption(dialog, label)).toHaveAttribute(
        SELECTED_ATTRIBUTE,
        "true",
      );
    }

    await setSelected(eventOption(dialog, NEW_REVIEW), false);
    await expect(starGroup(dialog)).toHaveCount(0);
  });

  test(`${channel.trigger} describes the star group`, async ({ page }) => {
    const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);
    const group = starGroup(dialog);

    await expect(group).toHaveAccessibleDescription(
      "Reviews with these stars arrive as new reviews. When Negative review is ticked too, a low review outside these stars still arrives as a negative review.",
    );
    await pickStars(dialog, []);
    await expect(group).toHaveAccessibleDescription("Pick at least one star.");
  });

  test(`${channel.trigger} refuses to save a new review without a star`, async ({
    page,
  }) => {
    const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);
    await pickStars(dialog, []);
    await page.getByLabel(channel.field).fill(channel.target());
    let posted = false;
    page.on("request", (request) => {
      if (request.method() === "POST") posted = true;
    });

    await dialog
      .getByRole("button", { name: channel.trigger, exact: true })
      .click();

    await expect(
      dialog.getByText("Pick at least one star", { exact: true }),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(posted).toBe(false);
  });

  test(`${channel.trigger} sends and shows the picked stars`, async ({
    page,
  }) => {
    const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);
    await pickStars(dialog, ["1 star", "2 stars"]);

    const { row, body } = await submitChannel(page, channel, dialog);

    expect(body).toMatchObject({
      events: ["review.new"],
      reviewScores: [1, 2],
    });
    await expect(row.locator('[data-slot="badge"]')).toHaveText([
      "New review · 1 and 2 stars",
    ]);
  });

  test(`${channel.trigger} sends every star as an empty filter`, async ({
    page,
  }) => {
    const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);

    const { row, body } = await submitChannel(page, channel, dialog);

    expect(body).toMatchObject({ events: ["review.new"], reviewScores: [] });
    await expect(row.locator('[data-slot="badge"]')).toHaveText([NEW_REVIEW]);
  });

  test(`${channel.trigger} sends no star filter without New review`, async ({
    page,
  }) => {
    const dialog = await openWithEvents(page, channel, [SERP_ENTRANT]);

    const { body } = await submitChannel(page, channel, dialog);

    expect(body).not.toHaveProperty("reviewScores");
    expect(body).toMatchObject({ events: ["serp.entrant"] });
  });

  test(`${channel.trigger} edits the saved stars of a channel`, async ({
    page,
  }) => {
    const created = await openWithEvents(page, channel, [NEW_REVIEW]);
    await pickStars(created, ["1 star", "2 stars"]);
    const { row } = await submitChannel(page, channel, created);

    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    for (const label of STAR_LABELS) {
      await expect(starOption(dialog, label)).toHaveAttribute(
        SELECTED_ATTRIBUTE,
        String(label === "1 star" || label === "2 stars"),
      );
    }
    await pickStars(dialog, ["5 stars"]);
    const patch = page.waitForRequest(
      (request) => request.method() === "PATCH",
    );
    await dialog.getByRole("button", { name: "Save events" }).click();

    expect((await patch).postDataJSON()).toEqual({
      events: ["review.new"],
      reviewScores: [5],
    });
    await expect(dialog).toBeHidden();
    await expect(row.locator('[data-slot="badge"]')).toHaveText([
      "New review · 5 stars",
    ]);
  });

  test(`${channel.trigger} cannot save an edit without a star`, async ({
    page,
  }) => {
    const created = await openWithEvents(page, channel, [NEW_REVIEW]);
    const { row } = await submitChannel(page, channel, created);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);

    await pickStars(dialog, []);

    await expect(
      dialog.getByRole("button", { name: "Save events" }),
    ).toBeDisabled();
    await expect(dialog.getByText("Pick at least one star.")).toBeVisible();
  });

  test(`${channel.trigger} discards a star change closed with Escape`, async ({
    page,
  }) => {
    const created = await openWithEvents(page, channel, [NEW_REVIEW]);
    await pickStars(created, ["4 stars", "5 stars"]);
    const { row } = await submitChannel(page, channel, created);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    await setSelected(starOption(dialog, "1 star"), true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const reopened = await openSettledDialog(page, EDIT_EVENTS, row);
    await expect(starOption(reopened, "1 star")).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "false",
    );
    await expect(starOption(reopened, "5 stars")).toHaveAttribute(
      SELECTED_ATTRIBUTE,
      "true",
    );
  });

  test(`${channel.trigger} toggles a star from the keyboard`, async ({
    page,
  }) => {
    const created = await openWithEvents(page, channel, [NEW_REVIEW]);
    const { row } = await submitChannel(page, channel, created);
    const dialog = await openSettledDialog(page, EDIT_EVENTS, row);
    const three = starOption(dialog, "3 stars");

    await three.focus();
    await page.keyboard.press("Space");
    await expect(three).toHaveAttribute(SELECTED_ATTRIBUTE, "false");
    await page.keyboard.press("Space");
    await expect(three).toHaveAttribute(SELECTED_ATTRIBUTE, "true");

    await eventOption(dialog, CHART_MILESTONE).focus();
    await page.keyboard.press("Tab");
    await expect(starOption(dialog, "1 star")).toBeFocused();
    await starOption(dialog, "5 stars").focus();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Save events" }),
    ).toBeFocused();
  });

  test(`${channel.trigger} fits a phone with the star group`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);

    await expect(starGroup(dialog)).toBeVisible();
    await expectFitsViewport(page, dialog);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
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

  for (const viewport of VIEWPORTS) {
    test(`${channel.trigger} keeps the stars still while 2 stars is pressed at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const dialog = await openWithEvents(page, channel, [NEW_REVIEW]);
      await pickStars(dialog, ["1 star"]);

      const group = starGroup(dialog);
      const option = starOption(dialog, "2 stars");
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
        "the star must not move when pressed",
      );
      await expect(option).toHaveAttribute(SELECTED_ATTRIBUTE, "true");
      expectSameBox(
        await boxOf(option),
        optionBox,
        "the star must not move once ticked",
      );
      expectSameBox(
        await boxOf(group),
        groupBox,
        "the stars must not reflow once ticked",
      );
    });
  }
}

test("the webhook dialog names the chat tool a url reaches", async ({
  page,
}) => {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");
  const field = page.getByLabel("Endpoint URL");
  const hint = dialog.locator("#webhook-channel-hint");

  await field.fill("https://discord.com/api/webhooks/1/abc");
  await expect(hint).toHaveText(
    "Recognised as Discord. Reports arrive as embeds with the app icon.",
  );
  await expect(field).toHaveAttribute(
    "aria-describedby",
    "webhook-channel-hint",
  );

  await field.fill("https://api.telegram.org/bot1:SECRET/sendMessage");
  await expect(hint).toHaveText(
    "Recognised as Telegram. Add ?chat_id=<id> after sendMessage.",
  );

  const slack = `https://hooks.slack.com/services/T1/B2/${randomUUID()}`;
  await field.fill(slack);
  await dialog
    .getByRole("button", { name: "Add webhook", exact: true })
    .click();
  await expect(dialog).toBeHidden();

  const row = page
    .getByRole("listitem")
    .filter({ hasText: "hooks.slack.com/services/T1/B2/…" })
    .first();
  await expect(row.getByText("Slack", { exact: true })).toBeVisible();
  await expect(page.getByText(slack)).toHaveCount(0);
});
