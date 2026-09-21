import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { typeInto } from "./type.mts";
import { KEYWORD_FIELD_BYTE_LIMIT } from "@asobeast/shared";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const STORED = "focus timer,pomodoro,study timer";

function storeField(page: Page, appId: string, text: string) {
  return page.request.put(`${MOCK_API_URL}/apps/${appId}/keyword-field`, {
    data: { text },
  });
}

test("the keyword field refuses to save past its byte limit", async ({
  page,
}) => {
  await storeField(page, "app-1", "");
  await page.goto("/apps/app-1/keywords");

  const editor = page.getByRole("textbox", { name: "App Store keyword field" });
  const save = page.getByRole("button", { name: "Save keyword field" });

  await editor.fill("a".repeat(KEYWORD_FIELD_BYTE_LIMIT));
  await expect(
    page.getByText(`${KEYWORD_FIELD_BYTE_LIMIT}/${KEYWORD_FIELD_BYTE_LIMIT}`),
  ).toBeVisible();
  await expect(save).toBeEnabled();

  await editor.fill("a".repeat(KEYWORD_FIELD_BYTE_LIMIT + 5));
  await expect(page.getByText("5 over the limit")).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(editor).toHaveAttribute("aria-invalid", "true");
});

test("the keyword field counts letters such as ą in bytes, as App Store Connect does", async ({
  page,
}) => {
  await storeField(page, "app-1", "");
  await page.goto("/apps/app-1/keywords");

  const editor = page.getByRole("textbox", { name: "App Store keyword field" });
  await editor.fill(
    "zażółć,gęślą,jaźń,łódź,źrebię,ćma,żółw,świeca,mąka,ślimak,pączek,żaba,źdźbło,ćwierć",
  );

  await expect(page.locator("#keyword-field-count")).toHaveText(
    `111/${KEYWORD_FIELD_BYTE_LIMIT} · 11 over the limit`,
  );
  await expect(
    page.getByRole("button", { name: "Save keyword field" }),
  ).toBeDisabled();
});

test.describe("the keyword field counts what it stores", () => {
  const counter = (page: Page) => page.locator("#keyword-field-count");

  test.beforeEach(async ({ page }) => {
    await storeField(page, "app-1", "");
    await page.goto("/apps/app-1/keywords");
  });

  const editorOf = (page: Page) =>
    page.getByRole("textbox", { name: "App Store keyword field" });

  test("duplicates the api drops do not count against the limit", async ({
    page,
  }) => {
    await editorOf(page).fill("a,".repeat(60));

    await expect(counter(page)).toHaveText(`1/${KEYWORD_FIELD_BYTE_LIMIT}`);
    await expect(
      page.getByRole("button", { name: "Save keyword field" }),
    ).toBeEnabled();
  });

  test("spacing after commas is not stored", async ({ page }) => {
    await editorOf(page).fill("fitness, workout, running");

    await expect(counter(page)).toHaveText(`23/${KEYWORD_FIELD_BYTE_LIMIT}`);
    await expect(
      page.getByText("Stored as fitness,workout,running"),
    ).toBeVisible();
  });

  test("case and repetition collapse into one phrase", async ({ page }) => {
    await editorOf(page).fill("Fitness,FITNESS, fitness");

    await expect(counter(page)).toHaveText(`7/${KEYWORD_FIELD_BYTE_LIMIT}`);
    await expect(page.getByText("Stored as fitness")).toBeVisible();
  });
});

test.describe("the stored keyword field", () => {
  test.describe.configure({ mode: "serial" });

  test("survives a reload", async ({ page }) => {
    await storeField(page, "app-2", "");
    await page.goto("/apps/app-2/keywords");

    const editor = page.getByRole("textbox", {
      name: "App Store keyword field",
    });
    const save = page.getByRole("button", { name: "Save keyword field" });
    const counter = page.locator("#keyword-field-count");
    const bytes = page.getByText("Bytes used");

    await typeInto(editor, STORED);
    await save.click();

    await expect(page.getByText("Saved keyword field")).toBeVisible();
    await expect(bytes).toBeVisible();
    await expect(counter).toHaveText(
      `${STORED.length}/${KEYWORD_FIELD_BYTE_LIMIT}`,
    );

    await page.reload();

    await expect(editor).toHaveValue(STORED);
    await expect(counter).toHaveText(
      `${STORED.length}/${KEYWORD_FIELD_BYTE_LIMIT}`,
    );
    await expect(bytes).toBeVisible();
    for (const phrase of STORED.split(",")) {
      await expect(page.getByText(phrase, { exact: true })).toBeVisible();
    }
    await expect(save).toBeDisabled();
  });

  test("can be emptied, which is how its phrases are untracked", async ({
    page,
  }) => {
    await storeField(page, "app-2", STORED);
    await page.goto("/apps/app-2/keywords");

    const editor = page.getByRole("textbox", {
      name: "App Store keyword field",
    });
    const save = page.getByRole("button", { name: "Save keyword field" });

    await expect(editor).toHaveValue(STORED);
    await expect(save).toBeDisabled();

    await typeInto(editor, "");
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText("Saved keyword field")).toBeVisible();
    await expect(page.getByText("Characters used")).toBeHidden();
    await expect(save).toBeDisabled();

    await page.reload();
    await expect(editor).toHaveValue("");
  });
});
