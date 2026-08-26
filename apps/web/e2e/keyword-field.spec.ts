import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { KEYWORD_FIELD_CHAR_LIMIT } from "@asobeast/shared";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const STORED = "focus timer,pomodoro,study timer";

function storeField(page: Page, appId: string, text: string) {
  return page.request.put(`${MOCK_API_URL}/apps/${appId}/keyword-field`, {
    data: { text },
  });
}

async function typeInto(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 1000 });
  }).toPass();
}

test("the keyword field refuses to save past its character limit", async ({
  page,
}) => {
  await storeField(page, "app-1", "");
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
  await storeField(page, "app-2", "");
  await page.goto("/apps/app-2/keywords");

  const editor = page.getByRole("textbox", { name: "App Store keyword field" });
  const save = page.getByRole("button", { name: "Save keyword field" });
  const counter = page.locator("#keyword-field-count");
  const characters = page.getByText("Characters used");

  await typeInto(editor, STORED);
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
