import type {
  AlertsConfig,
  CompetitorItem,
  EmailAlertItem,
  KeywordFieldResult,
  WebhookItem,
} from "@asobeast/shared";
import {
  ESSENTIAL_ALERT_EVENTS,
  KEYWORD_FIELD_CHAR_LIMIT,
} from "@asobeast/shared";
import { expect, test } from "./session.mts";
import {
  APP_1_DETAIL,
  APP_GP_DETAIL,
  APP_GP_DISCOVERY,
  ESSENTIAL_ALERT_COOKIE,
} from "./fixtures.mts";

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

test("adding more than 200 keywords at once is refused like the api", async ({
  page,
}) => {
  const keywords = Array.from({ length: 201 }, (_, index) => `phrase ${index}`);

  const response = await page.request.post(
    `${MOCK_API_URL}/apps/app-combos/keywords`,
    { data: { keywords, country: "us" } },
  );

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    message: "keywords must contain no more than 200 elements",
  });
});

test("patching a webhook's events answers with the item", async ({ page }) => {
  const created = await page.request.post(`${MOCK_API_URL}/webhooks`, {
    data: {
      url: "https://hooks.example.com/patch-seam",
      events: ["serp.entrant"],
      secret: "seam-secret",
    },
  });
  const { id } = (await created.json()) as WebhookItem;

  const patched = await page.request.patch(`${MOCK_API_URL}/webhooks/${id}`, {
    data: { events: ["rank.milestone"] },
  });

  expect(patched.status()).toBe(200);
  await expect(patched.json()).resolves.toMatchObject({
    id,
    events: ["rank.milestone"],
    hasSecret: true,
  } satisfies Partial<WebhookItem>);
});

test("patching an email alert's events answers with the item", async ({
  page,
}) => {
  const created = await page.request.post(`${MOCK_API_URL}/email-alerts`, {
    data: { email: "patch-seam@example.com", events: ["serp.entrant"] },
  });
  const { id } = (await created.json()) as EmailAlertItem;

  const patched = await page.request.patch(
    `${MOCK_API_URL}/email-alerts/${id}`,
    { data: { events: ["rank.first"] } },
  );

  expect(patched.status()).toBe(200);
  await expect(patched.json()).resolves.toMatchObject({
    id,
    email: "patch-seam@example.com",
    events: ["rank.first"],
  } satisfies Partial<EmailAlertItem>);
});

test("patching a channel refuses no events and an unknown id", async ({
  page,
}) => {
  const created = await page.request.post(`${MOCK_API_URL}/webhooks`, {
    data: {
      url: "https://hooks.example.com/empty-seam",
      events: ["serp.entrant"],
    },
  });
  const { id } = (await created.json()) as WebhookItem;

  const empty = await page.request.patch(`${MOCK_API_URL}/webhooks/${id}`, {
    data: { events: [] },
  });
  const missing = await page.request.patch(`${MOCK_API_URL}/webhooks/missing`, {
    data: { events: ["rank.first"] },
  });

  expect(empty.status()).toBe(400);
  expect(missing.status()).toBe(404);
});

test("patching a channel refuses a null event list and keeps its events", async ({
  page,
}) => {
  const hook = await page.request.post(`${MOCK_API_URL}/webhooks`, {
    data: {
      url: "https://hooks.example.com/null-seam",
      events: ["serp.entrant"],
    },
  });
  const email = await page.request.post(`${MOCK_API_URL}/email-alerts`, {
    data: { email: "null-seam@example.com", events: ["serp.entrant"] },
  });
  const { id: hookId } = (await hook.json()) as WebhookItem;
  const { id: emailId } = (await email.json()) as EmailAlertItem;

  const hookPatch = await page.request.patch(
    `${MOCK_API_URL}/webhooks/${hookId}`,
    { data: { events: null } },
  );
  const emailPatch = await page.request.patch(
    `${MOCK_API_URL}/email-alerts/${emailId}`,
    { data: { events: null } },
  );

  expect(hookPatch.status()).toBe(400);
  expect(emailPatch.status()).toBe(400);
  const hooks = (await (
    await page.request.get(`${MOCK_API_URL}/webhooks`)
  ).json()) as WebhookItem[];
  const alerts = (await (
    await page.request.get(`${MOCK_API_URL}/email-alerts`)
  ).json()) as EmailAlertItem[];
  expect(hooks.find((row) => row.id === hookId)?.events).toEqual([
    "serp.entrant",
  ]);
  expect(alerts.find((row) => row.id === emailId)?.events).toEqual([
    "serp.entrant",
  ]);
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

test("a webhook keeps the confirm drops setting like the api", async ({
  page,
}) => {
  const created = await page.request.post(`${MOCK_API_URL}/webhooks`, {
    data: {
      url: "https://hooks.example.com/confirm-seam",
      events: ["rank.dropped"],
      confirmDrops: true,
    },
  });
  const webhook = (await created.json()) as WebhookItem;
  expect(webhook).toMatchObject({
    confirmDrops: true,
  } satisfies Partial<WebhookItem>);

  const patched = await page.request.patch(
    `${MOCK_API_URL}/webhooks/${webhook.id}`,
    { data: { confirmDrops: false } },
  );

  await expect(patched.json()).resolves.toMatchObject({
    events: ["rank.dropped"],
    confirmDrops: false,
  } satisfies Partial<WebhookItem>);
});

test("an email alert keeps the confirm drops setting like the api", async ({
  page,
}) => {
  const created = await page.request.post(`${MOCK_API_URL}/email-alerts`, {
    data: {
      email: "confirm-seam@example.com",
      events: ["rank.dropped"],
      confirmDrops: true,
    },
  });
  const alert = (await created.json()) as EmailAlertItem;
  expect(alert).toMatchObject({
    confirmDrops: true,
  } satisfies Partial<EmailAlertItem>);

  const patched = await page.request.patch(
    `${MOCK_API_URL}/email-alerts/${alert.id}`,
    { data: { confirmDrops: false } },
  );

  await expect(patched.json()).resolves.toMatchObject({
    events: ["rank.dropped"],
    confirmDrops: false,
  } satisfies Partial<EmailAlertItem>);
});

for (const [route, base] of [
  ["webhooks", { url: "https://hooks.example.com/threshold-seam" }],
  ["email-alerts", { email: "threshold-seam@example.com" }],
] as const) {
  test(`a ${route} subscription keeps its rank drop threshold like the api`, async ({
    page,
  }) => {
    const created = await page.request.post(`${MOCK_API_URL}/${route}`, {
      data: { ...base, events: ["rank.dropped"], rankDropThreshold: 10 },
    });
    const item = (await created.json()) as WebhookItem | EmailAlertItem;
    expect(item.rankDropThreshold).toBe(10);
    const path = `${MOCK_API_URL}/${route}/${item.id}`;

    const changed = await page.request.patch(path, {
      data: { rankDropThreshold: 3 },
    });
    await expect(changed.json()).resolves.toMatchObject({
      rankDropThreshold: 3,
      events: ["rank.dropped"],
    });
    const kept = await page.request.patch(path, {
      data: { events: ["rank.first"] },
    });
    await expect(kept.json()).resolves.toMatchObject({ rankDropThreshold: 3 });
    const cleared = await page.request.patch(path, {
      data: { rankDropThreshold: null },
    });
    await expect(cleared.json()).resolves.toMatchObject({
      rankDropThreshold: null,
    });

    for (const rankDropThreshold of [0, 201]) {
      const refused = await page.request.post(`${MOCK_API_URL}/${route}`, {
        data: { ...base, events: ["rank.dropped"], rankDropThreshold },
      });
      expect(refused.status()).toBe(400);
      const refusedPatch = await page.request.patch(path, {
        data: { rankDropThreshold },
      });
      expect(refusedPatch.status()).toBe(400);
      await expect(refusedPatch.json()).resolves.toMatchObject({
        statusCode: 400,
      });
    }
  });
}

test("the alerts config names the instance threshold and what the essentials need", async ({
  page,
}) => {
  const config = (cookie?: string) =>
    page.request
      .get(`${MOCK_API_URL}/alerts/config`, {
        headers: cookie ? { cookie } : {},
      })
      .then((response) => response.json() as Promise<AlertsConfig>);

  await expect(config()).resolves.toEqual({
    emailEnabled: true,
    rankDropThreshold: 5,
    essentialAlertsNeed: null,
    essentialAlertsPending: true,
  });
  await expect(config("e2e_essentials_settled=1")).resolves.toMatchObject({
    essentialAlertsPending: false,
  });
  await expect(config("e2e_smtp_off=1")).resolves.toMatchObject({
    emailEnabled: false,
    essentialAlertsNeed: "smtp",
  });
  await expect(config("e2e_https_needed=1")).resolves.toMatchObject({
    emailEnabled: true,
    essentialAlertsNeed: "https",
  });
});

test("the essential alert cookie answers the essential subscription", async ({
  page,
}) => {
  const response = await page.request.get(`${MOCK_API_URL}/email-alerts`, {
    headers: { cookie: `${ESSENTIAL_ALERT_COOKIE}=1` },
  });

  await expect(response.json()).resolves.toEqual([
    expect.objectContaining({
      essential: true,
      rankDropThreshold: 10,
      confirmDrops: true,
      events: [...ESSENTIAL_ALERT_EVENTS],
    }),
  ]);
});

test("a refused rating drop threshold leaves the email alert as it was", async ({
  page,
}) => {
  const created = await page.request.post(`${MOCK_API_URL}/email-alerts`, {
    data: { email: "tenths-seam@example.com", events: ["rank.dropped"] },
  });
  const alert = (await created.json()) as EmailAlertItem;

  const refused = await page.request.patch(
    `${MOCK_API_URL}/email-alerts/${alert.id}`,
    { data: { events: ["rank.first"], ratingDropTenths: 11 } },
  );
  expect(refused.status()).toBe(400);

  const listed = await page.request.get(`${MOCK_API_URL}/email-alerts`);
  const rows = (await listed.json()) as EmailAlertItem[];
  expect(rows.find((row) => row.id === alert.id)).toMatchObject({
    events: ["rank.dropped"],
    ratingDropTenths: alert.ratingDropTenths,
  });
});
