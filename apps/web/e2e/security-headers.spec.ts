import { expect, test } from "./session.mts";

const REQUIRED_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

test("a rendered page carries the headers a hosted deployment needs", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response!.headers()).toMatchObject(REQUIRED_HEADERS);
});

test("an error page carries them too", async ({ page }) => {
  const response = await page.goto("/nothing-is-here");

  expect(response).not.toBeNull();
  expect(response!.headers()).toMatchObject(REQUIRED_HEADERS);
});

test("the web liveness route carries them", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.headers()).toMatchObject(REQUIRED_HEADERS);
});

test("a proxied api response carries them from the web origin", async ({
  request,
}) => {
  const response = await request.get("/api/backend/health");

  expect(response.ok()).toBe(true);
  expect(response.headers()).toMatchObject(REQUIRED_HEADERS);
});

test("a proxied error envelope carries them too", async ({ request }) => {
  const response = await request.get("/api/backend/apps/does-not-exist");

  expect(response.headers()).toMatchObject(REQUIRED_HEADERS);
});
