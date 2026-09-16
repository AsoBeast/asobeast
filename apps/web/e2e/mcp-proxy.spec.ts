import { expect } from "@playwright/test";
import { test } from "./reporting.mts";

test("a streamed mcp answer outlives the proxy deadline", async ({
  request,
}) => {
  const response = await request.post("/api/backend/mcp", {
    headers: {
      accept: "application/json, text/event-stream",
      authorization: "Bearer asob_e2e",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    timeout: 10_000,
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/event-stream");
  expect(await response.text()).toContain('"result":{"tools":[]}');
});

test("a listen stream the endpoint does not offer names the allowed method", async ({
  request,
}) => {
  const response = await request.get("/api/backend/mcp", {
    headers: { authorization: "Bearer asob_e2e" },
  });

  expect(response.status()).toBe(405);
  expect(response.headers().allow).toBe("POST");
});

test("a request without a token is challenged for a bearer token", async ({
  request,
}) => {
  const response = await request.post("/api/backend/mcp", {
    headers: { accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });

  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toMatch(/^Bearer/);
});

test("path aware oauth discovery for the endpoint answers a json 404", async ({
  request,
}) => {
  const response = await request.get(
    "/.well-known/oauth-protected-resource/api/backend/mcp",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
});
