import type { ApiErrorEnvelope } from "@asobeast/shared";
import { SESSION_COOKIE } from "@asobeast/shared";
import { expect, test } from "./session.mts";

const SESSION = { cookie: `${SESSION_COOKIE}=e2e` };
const MALFORMED_ESCAPES = ["%zz", "%", "%E0%A4%A", "%C0%AF", "%ED%A0%80"];
const HIDDEN_SURFACES = ["/docs", "/admin/queues", "/.well-known"];
const METHODS = ["GET", "POST"] as const;
const PAGES = ["/apps/%zz", "/apps/x%zz/keywords", "/apps/%E0%A4%A"];

for (const escape of MALFORMED_ESCAPES) {
  test(`the api proxy answers the 400 envelope for ${escape}`, async ({
    request,
  }) => {
    const response = await request.get(
      `/api/backend/apps/${escape}?token=secret`,
    );

    expect(response.status()).toBe(400);
    const envelope = (await response.json()) as ApiErrorEnvelope;
    expect(envelope).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      path: `/api/backend/apps/${escape}`,
    });
    expect(envelope.message).toContain(escape);
    expect(JSON.stringify(envelope)).not.toContain("secret");
  });
}

for (const surface of HIDDEN_SURFACES) {
  for (const method of METHODS) {
    test(`${method} ${surface} answers the hidden not found for a malformed escape`, async ({
      request,
    }) => {
      const path = `${surface}/%zz`;

      const response = await request.fetch(path, { method, maxRedirects: 0 });

      expect(response.status()).toBe(404);
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toMatchObject({
        statusCode: 404,
        message: `Cannot ${method} ${path}`,
        path,
      });
    });
  }
}

for (const path of PAGES) {
  test(`${path} is not found with a session`, async ({ request }) => {
    const response = await request.get(path, {
      headers: SESSION,
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
  });

  test(`${path} is not found without a session`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  });
}

test("a page with a malformed escape renders the not found page", async ({
  page,
}) => {
  const response = await page.goto("/apps/%zz");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("a path with a valid escape still reaches the api", async ({
  request,
}) => {
  const response = await request.get("/api/backend/apps/a%20b");

  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ statusCode: 404 });
});
