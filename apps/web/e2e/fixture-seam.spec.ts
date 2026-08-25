import type {
  CompetitorItem,
  EmailAlertItem,
  KeywordFieldResult,
  WebhookItem,
} from "@asobeast/shared";
import { KEYWORD_FIELD_CHAR_LIMIT } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { APP_1_DETAIL, APP_GP_DETAIL, APP_GP_DISCOVERY } from "./fixtures.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const [DISCOVERED] = APP_GP_DISCOVERY.items;
const PLAY_URL = `https://play.google.com/store/apps/details?id=${DISCOVERED.storeAppId}`;

test("the google play app names its store and links to the play listing", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}`);

  const header = page
    .locator("header")
    .filter({ has: page.getByRole("heading", { level: 1 }) });

  await expect(header.getByText("Google Play", { exact: true })).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Store page" }),
  ).toHaveAttribute(
    "href",
    `https://play.google.com/store/apps/details?id=${APP_GP_DETAIL.storeAppId}`,
  );
});

test("adding a competitor answers with the captured play item", async ({
  page,
}) => {
  const created = await page.request.post(
    `${MOCK_API_URL}/apps/${APP_GP_DETAIL.id}/competitors`,
    { data: { url: PLAY_URL } },
  );

  expect(created.status()).toBe(201);
  const competitor = (await created.json()) as CompetitorItem;
  expect(competitor).toMatchObject({
    store: "GOOGLE_PLAY",
    name: DISCOVERED.title,
  });
  expect(competitor.latestSnapshot?.subtitle).toBeNull();
  expect(competitor.latestSnapshot?.summary).not.toBeNull();
});

test("adding a competitor from another store is refused the way the api refuses it", async ({
  page,
}) => {
  const response = await page.request.post(
    `${MOCK_API_URL}/apps/${APP_1_DETAIL.id}/competitors`,
    { data: { url: PLAY_URL } },
  );

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    message: "Competitor must be on the same store as the primary app",
  });
});

test("saving the keyword field answers with the counts the product derives", async ({
  page,
}) => {
  const response = await page.request.put(
    `${MOCK_API_URL}/apps/${APP_1_DETAIL.id}/keyword-field`,
    { data: { text: "focus timer, Focus Timer, deep work" } },
  );

  expect(response.status()).toBe(200);
  const result = (await response.json()) as KeywordFieldResult;
  expect(result).toMatchObject({
    charactersUsed: "focus timer,deep work".length,
    charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
    duplicatesRemoved: 1,
  });
  expect(result.tracked.map((keyword) => keyword.text)).toEqual([
    "focus timer",
    "deep work",
  ]);
});

test("creating an email alert answers with the item", async ({ page }) => {
  const created = await page.request.post(`${MOCK_API_URL}/email-alerts`, {
    data: { email: "seam@example.com", events: ["rank.dropped"] },
  });

  expect(created.status()).toBe(201);
  await expect(created.json()).resolves.toMatchObject({
    email: "seam@example.com",
    events: ["rank.dropped"],
    active: true,
  } satisfies Partial<EmailAlertItem>);
});

test("creating a webhook answers with the item", async ({ page }) => {
  const created = await page.request.post(`${MOCK_API_URL}/webhooks`, {
    data: {
      url: "https://hooks.example.com/seam",
      events: ["digest.weekly"],
      secret: "seam-secret",
    },
  });

  expect(created.status()).toBe(201);
  await expect(created.json()).resolves.toMatchObject({
    url: "https://hooks.example.com/seam",
    events: ["digest.weekly"],
    active: true,
    hasSecret: true,
  } satisfies Partial<WebhookItem>);
});
