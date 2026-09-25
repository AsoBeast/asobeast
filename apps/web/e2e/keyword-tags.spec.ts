import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const KEYWORDS = "/apps/app-tags/keywords";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keyword-annotations/app-tags`, {
    failOnStatusCode: true,
  });
});

const row = (page: Page, text: string) =>
  page.getByRole("row", { name: new RegExp(text) });

async function openEditor(page: Page, text: string) {
  await row(page, text)
    .getByRole("button", { name: "Keyword actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit tags and note" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit tags and note" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("the switch still pauses a keyword through the shared update", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  const patch = page.waitForRequest((request) => request.method() === "PATCH");
  await row(page, "focus timer")
    .getByRole("switch", { name: "Pause keyword" })
    .click();

  expect((await patch).postDataJSON()).toEqual({ active: false });
});

test("tags are added with enter, a comma and a suggestion, and saved", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "focus timer");
  const input = dialog.getByRole("textbox", { name: "Tags" });

  await input.fill("Exam Season");
  await input.press("Enter");
  await input.pressSequentially("students,");
  await input.pressSequentially("draft");
  await input.press("Enter");
  await input.press("Backspace");
  await dialog.getByRole("button", { name: "Add tag core" }).click();

  await expect(
    dialog.getByRole("button", { name: /^Remove tag / }),
  ).toHaveCount(3);
  const patch = page.waitForRequest((request) => request.method() === "PATCH");
  await dialog.getByRole("button", { name: "Save" }).click();

  expect((await patch).postDataJSON()).toEqual({
    tags: ["exam season", "students", "core"],
    note: null,
  });
  await expect(dialog).toBeHidden();
  await expect(
    row(page, "focus timer").getByRole("group", {
      name: "Tags: exam season, students, core",
    }),
  ).toBeVisible();
});

test("enter while composing text does not add a tag", async ({ page }) => {
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "focus timer");
  const input = dialog.getByRole("textbox", { name: "Tags" });

  await input.fill("专注");
  await input.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
      }),
    ),
  );

  await expect(
    dialog.getByRole("button", { name: /^Remove tag / }),
  ).toHaveCount(0);
  await expect(input).toHaveValue("专注");
});

test("a duplicate left in the field does not block saving", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "focus timer");
  const input = dialog.getByRole("textbox", { name: "Tags" });
  await input.fill("core");
  await input.press("Enter");
  await input.fill("Core");

  const patch = page.waitForRequest((request) => request.method() === "PATCH");
  await dialog.getByRole("button", { name: "Save" }).click();

  expect((await patch).postDataJSON()).toEqual({ tags: ["core"], note: null });
  await expect(dialog).toBeHidden();
});

test("an invalid or a ninth tag is refused and the note counts", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "focus timer");
  const input = dialog.getByRole("textbox", { name: "Tags" });

  await input.fill("#hash");
  await input.press("Enter");
  await expect(dialog.getByText(/start with a letter or number/)).toBeVisible();

  for (const tag of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    await input.fill(tag);
    await input.press("Enter");
  }
  await input.fill("i");
  await input.press("Enter");
  await expect(dialog.getByText("A keyword has at most 8 tags.")).toBeVisible();

  await dialog.getByRole("textbox", { name: "Note" }).fill("Push in May");
  await expect(dialog.getByText("11 / 500")).toBeVisible();
});

test("a failed save rolls the row back and keeps the dialog open", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "e2e-fail-keyword-patch",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "focus timer");
  const input = dialog.getByRole("textbox", { name: "Tags" });
  await input.fill("core");
  await input.press("Enter");

  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Could not update focus timer")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Remove tag core" }),
  ).toBeVisible();
});

test("saved tags and a note survive a reload", async ({ page }) => {
  await page.goto(KEYWORDS);
  const dialog = await openEditor(page, "pomodoro");
  const input = dialog.getByRole("textbox", { name: "Tags" });
  await input.fill("brand");
  await input.press("Enter");
  await dialog.getByRole("textbox", { name: "Note" }).fill("  Keep it  ");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();

  await expect(
    row(page, "pomodoro").getByRole("group", { name: "Tags: brand" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Note: Keep it" }),
  ).toBeVisible();
});

test.describe("bulk tagging", () => {
  const seedTags = (
    request: import("@playwright/test").APIRequestContext,
    keywordId: string,
    tags: string[],
  ) =>
    request.patch(`${MOCK_API_URL}/apps/app-tags/keywords/${keywordId}`, {
      data: { tags },
      failOnStatusCode: true,
    });

  async function tagSelection(page: Page, texts: string[], tag: string) {
    await page.goto(KEYWORDS);
    for (const text of texts) {
      await page.getByRole("checkbox", { name: `Select ${text}` }).check();
    }
    await page
      .getByRole("group", { name: "Bulk keyword actions" })
      .getByRole("button", { name: "Tag", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Tag to add or remove" }).fill(tag);
  }

  const patches = (page: Page) => {
    const sent: unknown[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH") sent.push(request.postDataJSON());
    });
    return sent;
  };

  test("adds a tag only to the keywords without it", async ({
    page,
    request,
  }) => {
    await seedTags(request, "kw-2", ["core"]);
    const sent = patches(page);
    await tagSelection(
      page,
      ["focus timer", "pomodoro", "study timer"],
      "core",
    );

    await page.getByRole("button", { name: "Add to 2 keywords" }).click();

    await expect(page.getByText("Tagged 2 keywords")).toBeVisible();
    expect(sent).toEqual([{ tags: ["core"] }, { tags: ["core"] }]);
  });

  test("removes a tag only from the keywords carrying it", async ({
    page,
    request,
  }) => {
    await seedTags(request, "kw-1", ["core"]);
    await seedTags(request, "kw-2", ["core", "brand"]);
    const sent = patches(page);
    await tagSelection(
      page,
      ["focus timer", "pomodoro", "study timer"],
      "core",
    );

    await page.getByRole("button", { name: "Remove from 2 keywords" }).click();

    await expect(page.getByText("Untagged 2 keywords")).toBeVisible();
    expect(sent).toEqual([{ tags: [] }, { tags: ["brand"] }]);
  });

  test("names a keyword skipped at the tag limit", async ({
    page,
    request,
  }) => {
    await seedTags(request, "kw-1", ["a", "b", "c", "d", "e", "f", "g", "h"]);
    await tagSelection(page, ["focus timer", "pomodoro"], "core");

    await expect(
      page.getByText("Skips 1 keyword at the 8 tag limit: focus timer"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to 1 keyword" }),
    ).toBeVisible();
  });
});
