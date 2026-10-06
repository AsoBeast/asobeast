import { expect, type Page } from "@playwright/test";

export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function settled(page: Page, path: string): Promise<string[]> {
  const errors = collectPageErrors(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return errors;
}

export async function expectHydratesCleanly(
  page: Page,
  name: string,
  path: string,
): Promise<void> {
  const errors = await settled(page, path);

  expect(new URL(page.url()).pathname, `${name} redirected away`).toBe(path);
  expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual([]);
}
