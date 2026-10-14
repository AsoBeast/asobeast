import type { BrowserContext } from "@playwright/test";
import type { AppSetupState, AppSetupUpdateRequest } from "@asobeast/shared";

export const SETUP_SESSION_COOKIE = "e2e_setup_session";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

const setupUrl = (appId: string) => `${MOCK_API_URL}/apps/${appId}/setup`;

export async function storedSetup(
  context: BrowserContext,
  appId: string,
): Promise<AppSetupState> {
  const response = await context.request.get(setupUrl(appId));
  return (await response.json()) as AppSetupState;
}

export async function seedSetup(
  context: BrowserContext,
  appId: string,
  patch: AppSetupUpdateRequest,
): Promise<void> {
  await context.request.patch(setupUrl(appId), { data: patch });
}

export const startedSetup = (
  context: BrowserContext,
  appId: string,
  market = "us",
): Promise<void> =>
  seedSetup(context, appId, {
    status: "in_progress",
    skipped: [],
    countriesReviewed: false,
    selectedMarkets: [market],
  });
