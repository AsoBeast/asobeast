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
