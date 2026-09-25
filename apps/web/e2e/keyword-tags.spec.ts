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
