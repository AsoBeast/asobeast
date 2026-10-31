import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect } from "./session.mts";
import { APP_IMPORT_ID } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

export const IMPORT_KEYWORDS_PATH = `/apps/${APP_IMPORT_ID}/keywords`;

export async function resetImportKeywords(
  request: APIRequestContext,
): Promise<void> {
  await request.post(`${MOCK_API_URL}/__reset/keywords/${APP_IMPORT_ID}`, {
    failOnStatusCode: true,
  });
}

export async function openImportDialog(
  page: Page,
  path = IMPORT_KEYWORDS_PATH,
): Promise<Locator> {
  await page.goto(path);
  const trigger = page.getByRole("button", { name: "Import CSV" }).first();
  await (await hydrated(trigger)).click();
  const dialog = page.getByRole("dialog", { name: "Import keywords from CSV" });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function chooseImportFile(
  dialog: Locator,
  content: string | Buffer,
  name = "keywords.csv",
): Promise<void> {
  await dialog.getByLabel("Keyword file").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: typeof content === "string" ? Buffer.from(content) : content,
  });
}
