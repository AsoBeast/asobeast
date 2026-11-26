import type { Page, Request } from "@playwright/test";
import { APP_TARGETS_ID } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { TARGETS_MOCK_URL, TARGETS_PATH } from "./listing-targets.mts";
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

test("shows three highlighted slots and seven more", async ({ page }) => {
  await page.goto(DRAFT);

  const roles = block(page).getByRole("list", { name: "Title and subtitle" });
  await expect(roles.getByRole("listitem")).toHaveCount(3);
  await expect(slot(page, "Title")).toBeVisible();
  await expect(slot(page, "Subtitle", 0)).toBeVisible();
  await expect(slot(page, "Subtitle", 1)).toBeVisible();
  await expect(slot(page, "Keyword 4")).toHaveCount(0);

  await (
    await hydrated(block(page).getByRole("button", { name: "Show more slots" }))
  ).click();

  const more = block(page).getByRole("list", { name: "More keywords" });
  await expect(more.getByRole("listitem")).toHaveCount(7);
  await expect(slot(page, "Keyword 10")).toBeVisible();
  await expect(block(page)).toContainText("Tracked in United States");
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

  await openPicker(page, "Subtitle");
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
  await expect(saveButton(page)).toHaveAttribute("aria-disabled", "true");
});

test("refuses a phrase already in another slot", async ({ page }) => {
  await seed(page, ["focus timer"]);
  await page.goto(DRAFT);

  await openPicker(page, "Subtitle");
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

  const remove = slot(page, "Subtitle", 0).getByRole("button", {
    name: "Remove study timer from Subtitle",
  });
  await (await hydrated(remove)).focus();
  await page.keyboard.press("Enter");

  await expect(
    slot(page, "Subtitle", 0).getByRole("button", {
      name: "Choose a keyword for Subtitle",
    }),
  ).toBeFocused();
  await expect(
    slot(page, "Subtitle", 1).getByRole("button", {
      name: "productivity app for Subtitle",
    }),
  ).toBeVisible();
});

test("discards the unsaved slots", async ({ page }) => {
  const bodies = savedBodies(page);
  await seed(page, ["focus timer"]);
  await page.goto(DRAFT);

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
    slot(page, "Subtitle", 0).getByRole("button", {
      name: "productivity app for Subtitle",
    }),
  ).toBeVisible();
  await expect(
    slot(page, "Subtitle", 1).getByRole("button", {
      name: "study timer for Subtitle",
    }),
  ).toBeVisible();
  await expect(block(page)).not.toContainText("pomodoro");
  await expect(saveButton(page)).toBeFocused();
});

test("says when there is nothing to fill", async ({ page }) => {
  await seed(page, ["focus timer", "study timer", "productivity app"]);
  await page.goto(DRAFT);

  const useTopThree = block(page).getByRole("button", { name: "Use top 3" });
  await expect(useTopThree).toHaveAttribute("aria-disabled", "true");
  await expect(useTopThree).toHaveAttribute(
    "title",
    "Title and subtitle slots are already filled",
  );
});
