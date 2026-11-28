import type { Page, Request } from "@playwright/test";
import { APP_TARGETS_ID } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import {
  TARGETS_FULL_COOKIE,
  TARGETS_MOCK_URL,
  TARGETS_PATH,
} from "./listing-targets.mts";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const DRAFT = `/apps/${APP_TARGETS_ID}/metadata?mode=draft`;

const block = (page: Page) =>
  page.getByRole("region", { name: "Targets for English (U.S.)" });
const slot = (page: Page, name: string, nth = 0) =>
  block(page).getByRole("listitem", { name, exact: true }).nth(nth);
const picker = (page: Page) => page.getByRole("dialog");
const saveButton = (page: Page) =>
  block(page).getByRole("button", { name: "Save targets" });
const editButton = (page: Page) =>
  block(page).getByRole("button", { name: "Edit targets" });

async function editTargets(page: Page) {
  await (await hydrated(editButton(page))).click();
  await expect(slot(page, "Title")).toBeVisible();
}

async function seed(page: Page, slots: string[]) {
  await page.request.post(
    `${TARGETS_MOCK_URL}/__seed/listing-targets/${APP_TARGETS_ID}/en-US`,
    { data: { slots }, failOnStatusCode: true },
  );
}

function savedBodies(page: Page): unknown[] {
  const sent: unknown[] = [];
  page.on("request", (request: Request) => {
    if (TARGETS_PATH.test(request.url()) && request.method() === "PUT") {
      sent.push(request.postDataJSON());
    }
  });
  return sent;
}

async function openPicker(page: Page, name: string, nth = 0) {
  await (
    await hydrated(slot(page, name, nth).getByRole("button").first())
  ).click();
  await expect(picker(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.request.post(
    `${TARGETS_MOCK_URL}/__reset/listing-targets/${APP_TARGETS_ID}`,
    { failOnStatusCode: true },
  );
});

test("opens the editor with three role slots and seven more when nothing is saved", async ({
  page,
}) => {
  await page.goto(DRAFT);

  const roles = block(page).getByRole("list", { name: "Title and subtitle" });
  await expect(roles.getByRole("listitem")).toHaveCount(3);
  await expect(slot(page, "Title")).toBeVisible();
  await expect(slot(page, "Subtitle 1")).toBeVisible();
  await expect(slot(page, "Subtitle 2")).toBeVisible();
  await expect(slot(page, "Keyword 4")).toHaveCount(0);

  await (
    await hydrated(block(page).getByRole("button", { name: "Show more slots" }))
  ).click();

  const more = block(page).getByRole("list", { name: "More keywords" });
  await expect(more.getByRole("listitem")).toHaveCount(7);
  await expect(slot(page, "Keyword 10")).toBeVisible();
  await expect(block(page)).toContainText("Read in United States");
});

test("picks a tracked keyword for a slot", async ({ page }) => {
  await page.goto(DRAFT);
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");

  await openPicker(page, "Title");
  await page.keyboard.type("produc");
  await picker(page)
    .getByRole("option", { name: /productivity app/ })
    .click();

  await expect(
    slot(page, "Title").getByRole("button", {
      name: "productivity app for Title",
    }),
  ).toBeVisible();
  await expect(slot(page, "Title")).toContainText("Popularity 65");
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
});

test("types a new phrase for a slot", async ({ page }) => {
  const bodies = savedBodies(page);
  await page.goto(DRAFT);

  await openPicker(page, "Subtitle 1");
  await page.keyboard.type("Sleep  Sounds");
  await picker(page)
    .getByRole("option", { name: "Track “sleep sounds”" })
    .click();
  await saveButton(page).click();

  await expect(
    page.getByText(
      "Targets saved. sleep sounds is now tracked in United States.",
    ),
  ).toBeVisible();
  expect(bodies).toEqual([
    {
      slots: [
        null,
        "sleep sounds",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    },
  ]);
  await expect(editButton(page)).toBeFocused();
  await expect(
    block(page).getByRole("list", { name: "Saved targets" }),
  ).toContainText("sleep sounds");
});

test("refuses a phrase already in another slot", async ({ page }) => {
  await seed(page, ["focus timer"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await openPicker(page, "Subtitle 1");
  await page.keyboard.type("focus timer");

  await expect(
    picker(page).getByRole("option", {
      name: "“focus timer” is already in Title",
    }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("clears a slot", async ({ page }) => {
  await seed(page, ["focus timer", "study timer", "productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);

  const remove = slot(page, "Subtitle 1").getByRole("button", {
    name: "Remove study timer from Subtitle 1",
  });
  await (await hydrated(remove)).focus();
  await page.keyboard.press("Enter");

  await expect(
    slot(page, "Subtitle 1").getByRole("button", {
      name: "Choose a keyword for Subtitle 1",
    }),
  ).toBeFocused();
  await expect(
    slot(page, "Subtitle 2").getByRole("button", {
      name: "productivity app for Subtitle 2",
    }),
  ).toBeVisible();
});

test("discards the unsaved slots", async ({ page }) => {
  const bodies = savedBodies(page);
  await seed(page, ["focus timer"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await (
    await hydrated(
      slot(page, "Title").getByRole("button", {
        name: "Remove focus timer from Title",
      }),
    )
  ).click();
  await block(page).getByRole("button", { name: "Discard changes" }).click();

  await expect(
    slot(page, "Title").getByRole("button", { name: "focus timer for Title" }),
  ).toBeVisible();
  expect(bodies).toEqual([]);
});

test("shows saved targets in one row and edits them on request", async ({
  page,
}) => {
  await seed(page, ["focus timer", "study timer"]);
  await page.goto(DRAFT);

  const saved = block(page).getByRole("list", { name: "Saved targets" });
  await expect(saved).toContainText("Titlefocus timer");
  await expect(saved).toContainText("Subtitle 1study timer");
  await expect(saved).toContainText("Subtitle 2Not set");
  await expect(slot(page, "Title")).toHaveCount(0);
  await expect(saveButton(page)).toHaveCount(0);

  await (await hydrated(editButton(page))).focus();
  await page.keyboard.press("Enter");
  await expect(
    slot(page, "Title").getByRole("button", { name: "focus timer for Title" }),
  ).toBeFocused();

  const done = block(page).getByRole("button", { name: "Done" });
  await done.focus();
  await page.keyboard.press("Enter");
  await expect(saved).toBeVisible();
  await expect(editButton(page)).toBeFocused();
});

test("is absent for a Google Play app and a competitor", async ({ page }) => {
  for (const id of ["app-gp", "app-rival"]) {
    await page.goto(`/apps/${id}/metadata?mode=draft`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /^Targets for / }),
    ).toHaveCount(0);
  }
});

test("fills the role slots with the top three by opportunity", async ({
  page,
}) => {
  await page.goto(DRAFT);
  const useTopThree = block(page).getByRole("button", { name: "Use top 3" });

  await (await hydrated(useTopThree)).focus();
  await page.keyboard.press("Enter");

  await expect(
    slot(page, "Title").getByRole("button", { name: "focus timer for Title" }),
  ).toBeVisible();
  await expect(
    slot(page, "Subtitle 1").getByRole("button", {
      name: "productivity app for Subtitle 1",
    }),
  ).toBeVisible();
  await expect(
    slot(page, "Subtitle 2").getByRole("button", {
      name: "study timer for Subtitle 2",
    }),
  ).toBeVisible();
  await expect(block(page)).not.toContainText("pomodoro");
  await expect(saveButton(page)).toBeFocused();
});

test("says when there is nothing to fill", async ({ page }) => {
  await seed(page, ["focus timer", "study timer", "productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);

  const useTopThree = block(page).getByRole("button", { name: "Use top 3" });
  await expect(useTopThree).toHaveAttribute("aria-disabled", "true");
  await expect(useTopThree).toHaveAttribute(
    "title",
    "Title and subtitle slots are already filled",
  );
});

test("moves a keyword up into the title slot from the keyboard", async ({
  page,
}) => {
  await seed(page, ["focus timer", "study timer"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await (
    await hydrated(
      slot(page, "Subtitle 1").getByRole("button", {
        name: "Move study timer up",
      }),
    )
  ).focus();
  await page.keyboard.press("Enter");

  const movedUp = slot(page, "Title").getByRole("button", {
    name: "Move study timer up",
  });
  await expect(movedUp).toBeFocused();
  await expect(movedUp).toHaveAttribute("aria-disabled", "true");
  await expect(
    slot(page, "Subtitle 1").getByRole("button", {
      name: "focus timer for Subtitle 1",
    }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(movedUp).toBeFocused();
});

test("announces the move", async ({ page }) => {
  await seed(page, ["focus timer", "study timer"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await (
    await hydrated(
      slot(page, "Title").getByRole("button", {
        name: "Move focus timer down",
      }),
    )
  ).click();

  await expect(block(page).getByRole("status")).toHaveText(
    "focus timer moved to Subtitle 1",
  );
});

test("says which keyword the limit left out", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: TARGETS_FULL_COOKIE, value: "1", domain: "localhost", path: "/" },
    ]);
  await page.goto(DRAFT);

  await openPicker(page, "Title");
  await page.keyboard.type("sleep sounds");
  await picker(page)
    .getByRole("option", { name: "Track “sleep sounds”" })
    .click();
  await saveButton(page).click();

  const notice = block(page).getByRole("note");
  await expect(notice).toContainText(
    "sleep sounds was not tracked in United States: your plan's keyword limit is reached.",
  );
  await expect(notice.getByRole("link", { name: "See plans" })).toBeVisible();
  await expect(notice).toContainText("is reached. See plans");
  await expect(slot(page, "Title")).toContainText(
    "Not tracked in United States",
  );
  await expect(
    slot(page, "Title").getByRole("button", {
      name: "sleep sounds for Title",
    }),
  ).toBeVisible();
});

test("offers to track a target in a market that reads it now", async ({
  page,
}) => {
  const bodies = savedBodies(page);
  await seed(page, ["sleep sounds"]);
  await page.goto(DRAFT);
  await expect(slot(page, "Title")).toContainText(
    "Not tracked in United States",
  );

  const track = block(page).getByRole("button", { name: "Track in 1 market" });
  await (await hydrated(track)).focus();
  await page.keyboard.press("Enter");

  await expect(block(page)).not.toContainText("Not tracked in");
  await expect(track).toHaveCount(0);
  await expect(editButton(page)).toBeFocused();
  expect(bodies).toEqual([
    {
      slots: [
        "sleep sounds",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      trackMissing: true,
    },
  ]);
});

const coverage = (page: Page) =>
  page.getByRole("region", { name: "Draft coverage" });
const targetRows = (page: Page) =>
  coverage(page).getByRole("list", { name: "Targets" }).getByRole("listitem");

test("says the draft covers the title target", async ({ page }) => {
  await seed(page, ["habit tracker", "focus timer"]);
  await page.goto(DRAFT);

  const title = page
    .getByRole("region", { name: "Draft listing" })
    .getByRole("textbox", { name: "Title", exact: true });
  await (await hydrated(title)).fill("Habit Tracker");

  await expect(targetRows(page).nth(0)).toContainText("habit tracker");
  await expect(targetRows(page).nth(0)).toContainText("Title");
  await expect(targetRows(page).nth(0)).toContainText("Covered");
  await expect(targetRows(page).nth(0)).toContainText("Newly covered");
  await expect(targetRows(page).nth(1)).toContainText("focus timer");
  await expect(targetRows(page).nth(1)).toContainText("Subtitle");
  await expect(targetRows(page).nth(1)).toContainText("Not covered");
  await expect(targetRows(page).nth(1)).toContainText("Was covered");
});

test("updates after saving targets", async ({ page }) => {
  await seed(page, ["habit tracker"]);
  await page.goto(DRAFT);
  await expect(targetRows(page)).toHaveCount(1);
  await expect(slot(page, "Title")).toContainText("Not tracked in");

  await openPicker(page, "Subtitle 1");
  await page.keyboard.type("study timer");
  await picker(page)
    .getByRole("option", { name: /study timer/ })
    .click();
  await saveButton(page).click();

  await expect(targetRows(page)).toHaveCount(2);
  await expect(targetRows(page).nth(1)).toContainText("study timer");
});

test("shows the targets before any field is edited", async ({ page }) => {
  const sent: unknown[] = [];
  page.on("request", (request) => {
    if (
      /\/metadata\/coverage-preview$/.test(request.url()) &&
      request.method() === "POST"
    ) {
      sent.push(request.postDataJSON());
    }
  });
  await seed(page, ["focus timer"]);
  await page.goto(DRAFT);

  await expect(targetRows(page)).toHaveCount(1);
  await expect(targetRows(page).nth(0)).toContainText("Covered");
  expect(sent[0]).toEqual({ localization: "en-US" });
});

const chip = (page: Page, name: string, phrase: string) =>
  slot(page, name).getByRole("button", {
    name: new RegExp(`^Suggested: .+\\. Why ${phrase} belongs there$`),
  });

test("shows a suggestion beside each target", async ({ page }) => {
  await seed(page, ["productivity app", "study timer"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await expect(
    slot(page, "Title").getByRole("button", {
      name: "Suggested: Title. Why productivity app belongs there",
    }),
  ).toHaveText("Title");
  await expect(
    slot(page, "Subtitle 1").getByRole("button", {
      name: "Suggested: Skip. Why study timer belongs there",
    }),
  ).toHaveText("Skip");
});

test("explains the suggestion in one sentence with graded figures", async ({
  page,
}) => {
  await seed(page, ["productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);

  await (await hydrated(chip(page, "Title", "productivity app"))).click();

  const popover = page.getByRole("dialog", {
    name: "Where productivity app belongs",
  });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText("Strong popularity");
  await expect(popover).toContainText(": belongs in the title.");
  await expect(popover.getByTitle("Popularity 65, strong")).toBeVisible();
  await expect(popover.getByTitle("Difficulty 60, weak")).toBeVisible();
});

test("shows suggestions in the picker", async ({ page }) => {
  await page.goto(DRAFT);

  await openPicker(page, "Title");

  await expect(
    picker(page).getByRole("option", { name: /productivity app/ }),
  ).toContainText("Title");
  await expect(
    picker(page).getByRole("option", { name: /study timer/ }),
  ).toContainText("Skip");
});

test("shows no chip without a verdict", async ({ page }) => {
  await seed(page, ["deep focus"]);
  await page.goto(DRAFT);

  await expect(
    slot(page, "Title").getByRole("button", { name: "deep focus for Title" }),
  ).toBeVisible();
  await expect(
    slot(page, "Title").getByRole("button", { name: /^Suggested:/ }),
  ).toHaveCount(0);
});

test("closes the popover with Escape and returns focus to the chip", async ({
  page,
}) => {
  await seed(page, ["productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);
  const trigger = chip(page, "Title", "productivity app");

  await (await hydrated(trigger)).focus();
  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog", {
    name: "Where productivity app belongs",
  });
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(popover).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("applies the suggestions as an unsaved edit", async ({ page }) => {
  const bodies = savedBodies(page);
  await seed(page, ["study timer", "productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);
  const apply = block(page).getByRole("button", { name: "Apply suggestions" });

  await (await hydrated(apply)).focus();
  await page.keyboard.press("Enter");

  await expect(
    slot(page, "Title").getByRole("button", {
      name: "productivity app for Title",
    }),
  ).toBeVisible();
  await expect(
    slot(page, "Subtitle 1").getByRole("button", {
      name: "Choose a keyword for Subtitle 1",
    }),
  ).toBeVisible();
  await expect(
    slot(page, "Keyword 4").getByRole("button", {
      name: "study timer for Keyword 4",
    }),
  ).toBeVisible();
  await expect(block(page).getByRole("status")).toHaveText(
    "Targets reordered to match the suggestions",
  );
  await expect(saveButton(page)).toBeFocused();
  await expect(saveButton(page)).not.toHaveAttribute("aria-disabled");
  expect(bodies).toEqual([]);

  await page.keyboard.press("Enter");

  await expect
    .poll(() => bodies)
    .toEqual([
      {
        slots: [
          "productivity app",
          null,
          null,
          "study timer",
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ]);
});

test("is unavailable when the order already matches", async ({ page }) => {
  await seed(page, ["productivity app"]);
  await page.goto(DRAFT);
  await editTargets(page);

  const apply = block(page).getByRole("button", { name: "Apply suggestions" });
  await expect(apply).toHaveAttribute("aria-disabled", "true");
  await expect(apply).toHaveAttribute(
    "title",
    "Your targets already follow the suggestions",
  );
});

test("keeps the header actions inside the card on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page, ["study timer", "productivity app"]);
  await page.goto(DRAFT);

  const tip = block(page).getByRole("button", {
    name: "About target keywords",
  });
  await expect(tip).toBeVisible();
  const card = block(page).locator('[data-slot="card"]');
  const { scrollWidth, clientWidth, right, tipRight } = await card.evaluate(
    (node, tipNode) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      right: node.getBoundingClientRect().right,
      tipRight: tipNode.getBoundingClientRect().right,
    }),
    await tip.elementHandle(),
  );
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  expect(tipRight).toBeLessThanOrEqual(right);
});
