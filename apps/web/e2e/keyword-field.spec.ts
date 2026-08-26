import { expect, test } from "./session.mts";
import { KEYWORD_FIELD_CHAR_LIMIT } from "@asobeast/shared";

const STORED = "focus timer,pomodoro,study timer";

test("the keyword field refuses to save past its character limit", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const editor = page.getByRole("textbox", { name: "App Store keyword field" });
  const save = page.getByRole("button", { name: "Save keyword field" });

  await editor.fill("a".repeat(KEYWORD_FIELD_CHAR_LIMIT));
  await expect(
    page.getByText(`${KEYWORD_FIELD_CHAR_LIMIT}/${KEYWORD_FIELD_CHAR_LIMIT}`),
  ).toBeVisible();
  await expect(save).toBeEnabled();

  await editor.fill("a".repeat(KEYWORD_FIELD_CHAR_LIMIT + 5));
  await expect(page.getByText("5 over the limit")).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(editor).toHaveAttribute("aria-invalid", "true");
});

test("the saved keyword field survives a reload", async ({ page }) => {
  await page.goto("/apps/app-2/keywords");

  const editor = page.getByRole("textbox", { name: "App Store keyword field" });
  const save = page.getByRole("button", { name: "Save keyword field" });
  const counter = page.locator("#keyword-field-count");
  const characters = page.getByText("Characters used");

  await editor.fill(STORED);
  await save.click();

  await expect(page.getByText("Saved keyword field")).toBeVisible();
  await expect(characters).toBeVisible();
  await expect(counter).toHaveText(
    `${STORED.length}/${KEYWORD_FIELD_CHAR_LIMIT}`,
  );

  await page.reload();

  await expect(editor).toHaveValue(STORED);
  await expect(counter).toHaveText(
    `${STORED.length}/${KEYWORD_FIELD_CHAR_LIMIT}`,
  );
  await expect(characters).toBeVisible();
  for (const phrase of STORED.split(",")) {
    await expect(page.getByText(phrase, { exact: true })).toBeVisible();
  }
  await expect(save).toBeDisabled();
});
