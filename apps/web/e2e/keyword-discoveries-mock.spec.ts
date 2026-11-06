import type {
  KeywordDiscoveryList,
  KeywordDiscoveryRefreshResult,
  KeywordDiscoverySettings,
  KeywordDiscoveryTrackResult,
} from "@asobeast/shared";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  DISCOVERY_REFRESH_QUEUED,
  DISCOVERY_SEAM_APP,
  KEYWORD_DISCOVERIES_APP_1,
} from "./keyword-discoveries.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const LIST_URL = `${MOCK_API_URL}/apps/${DISCOVERY_SEAM_APP}/keyword-discoveries`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.request.post(
    `${MOCK_API_URL}/__reset/keyword-discoveries/${DISCOVERY_SEAM_APP}`,
  );
});

const listOf = async (page: Page, query = ""): Promise<KeywordDiscoveryList> =>
  (await (
    await page.request.get(`${LIST_URL}${query}`)
  ).json()) as KeywordDiscoveryList;

test("the mock answers the seeded discoveries", async ({ page }) => {
  const list = await listOf(page);

  expect(list.items.map(({ text }) => text)).toEqual(
    KEYWORD_DISCOVERIES_APP_1.map(({ text }) => text),
  );
  expect(list.counts).toEqual({ all: 11, ranked: 4, opportunity: 1 });
  expect(list.checks).toMatchObject({
    perWeek: 40,
    usedThisWeek: 12,
    pending: 0,
  });
  expect((await listOf(page, "?country=pl")).counts).toEqual({
    all: 2,
    ranked: 1,
    opportunity: 0,
  });
});

test("tracking and dismissing remove rows and lower the counts", async ({
  page,
}) => {
  const [first, second] = (await listOf(page)).items;

  const tracked = await page.request.post(`${LIST_URL}/track`, {
    data: { keywordIds: [first.keywordId] },
  });
  expect((await tracked.json()) as KeywordDiscoveryTrackResult).toEqual({
    tracked: 1,
    skipped: 0,
  });
  const dismissed = await page.request.post(`${LIST_URL}/dismiss`, {
    data: { keywordIds: [second.keywordId] },
  });
  expect(await dismissed.json()).toEqual({ dismissed: 1 });

  const after = await listOf(page);
  expect(after.counts).toEqual({ all: 9, ranked: 2, opportunity: 1 });
  expect(after.items.map(({ keywordId }) => keywordId)).not.toContain(
    first.keywordId,
  );
});

test("a refresh queues checks that the next read reports as pending", async ({
  page,
}) => {
  const refreshed = await page.request.post(`${LIST_URL}/refresh`);

  expect(refreshed.status()).toBe(202);
  expect((await refreshed.json()) as KeywordDiscoveryRefreshResult).toEqual({
    queued: DISCOVERY_REFRESH_QUEUED,
    resolved: 1,
  });
  expect((await listOf(page)).checks.pending).toBe(DISCOVERY_REFRESH_QUEUED);
  expect((await listOf(page)).checks.pending).toBe(0);
});

test("the settings flip auto tracking and track the ranked rows", async ({
  page,
}) => {
  const response = await page.request.patch(`${LIST_URL}/settings`, {
    data: { autoTrackRanked: true },
  });

  expect((await response.json()) as KeywordDiscoverySettings).toEqual({
    autoTrackRanked: true,
    tracked: 4,
    skipped: 0,
  });
  const after = await listOf(page);
  expect(after.autoTrackRanked).toBe(true);
  expect(after.counts.ranked).toBe(0);
});

test("an unknown app answers 404", async ({ page }) => {
  const response = await page.request.get(
    `${MOCK_API_URL}/apps/app-missing/keyword-discoveries`,
  );

  expect(response.status()).toBe(404);
});
