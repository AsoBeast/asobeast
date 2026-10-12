import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { APP_LOCALES_ID, type LocalizationSeed } from "./fixtures.mts";

export const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
export const LOCALES_APP = APP_LOCALES_ID;
export const QUOTA_COOKIE = "e2e_keyword_quota";

export async function seedLocalizations(
  request: APIRequestContext,
  id: string,
  seed: LocalizationSeed = {},
): Promise<void> {
  await request.post(`${MOCK_API_URL}/__seed/localizations/${id}`, {
    data: seed,
    failOnStatusCode: true,
  });
}

export async function fieldRequests(
  request: APIRequestContext,
  id: string,
): Promise<string[]> {
  const response = await request.get(
    `${MOCK_API_URL}/__log/field-requests/${id}`,
    { failOnStatusCode: true },
  );
  return (await response.json()) as string[];
}

const escaped = (name: string): string =>
  name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function localizationItem(
  page: Page,
  name: string,
): { trigger: Locator; panel: Locator } {
  const label = new RegExp(`^${escaped(name)}`);
  return {
    trigger: page.getByRole("button", { name: label }),
    panel: page.getByRole("region", { name: label }),
  };
}
