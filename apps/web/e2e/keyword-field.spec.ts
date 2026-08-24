import { expect, test } from "./session.mts";
import { KEYWORD_FIELD_CHAR_LIMIT } from "@asobeast/shared";

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
