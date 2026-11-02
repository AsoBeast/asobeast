import type { Page, Route } from "@playwright/test";
import type { CompetitorItem, SerpSnapshot } from "@asobeast/shared";
import { SERP_TRACKABLE } from "./serp-history.mts";

export const SERP_TRACK_PATH = /\/api\/backend\/apps\/app-1\/competitors$/;

const TRACKED: CompetitorItem = {
  id: `comp-${SERP_TRACKABLE.storeAppId}`,
  store: "APP_STORE",
  name: SERP_TRACKABLE.title,
  iconUrl: null,
  latestSnapshot: null,
};

export const answerTrack = (route: Route) =>
  route.fulfill({ status: 201, json: TRACKED });

export async function showTrackedAfterAdd(page: Page): Promise<void> {
  let tracked = false;
  page.on("request", (request) => {
    if (request.method() === "POST" && SERP_TRACK_PATH.test(request.url())) {
      tracked = true;
    }
  });
  await page.route("**/api/backend/keywords/kw-3/serp*", async (route) => {
    if (!tracked) return route.fallback();
    const response = await route.fetch();
    const snapshot = (await response.json()) as SerpSnapshot;
    await route.fulfill({
      response,
      json: {
        ...snapshot,
        entries: snapshot.entries.map((entry) =>
          entry.storeAppId === SERP_TRACKABLE.storeAppId
            ? { ...entry, appId: TRACKED.id, isCompetitor: true }
            : entry,
        ),
      },
    });
  });
}
