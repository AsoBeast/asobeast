import { expect } from "@playwright/test";
import { test } from "./reporting.mts";

const DISCOVERY_PATHS = [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/api/backend/mcp",
  "/.well-known/oauth-authorization-server",
  "/.well-known/openid-configuration",
];

for (const path of DISCOVERY_PATHS) {
  test(`${path} answers a json 404 instead of the sign in page`, async ({
    request,
  }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(((await response.json()) as { statusCode: number }).statusCode).toBe(
      404,
    );
  });
}

test("a signed out page visit still goes to sign in", async ({ request }) => {
  const response = await request.get("/settings", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
});
