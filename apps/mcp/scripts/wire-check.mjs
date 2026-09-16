import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { MCP_TOOLS } from "@asobeast/mcp-tools";

const ENDPOINT = process.env.ASOBEAST_MCP_URL;
const TOKEN = process.env.ASOBEAST_API_TOKEN;

if (!ENDPOINT || !TOKEN) {
  process.stderr.write(
    "Set ASOBEAST_MCP_URL to the full mcp endpoint and ASOBEAST_API_TOKEN to a read-only asob_ token.\n",
  );
  process.exit(1);
}

const LIST_TOOLS = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
const responses = [];
const clients = {};

async function send(url, init) {
  const response = await fetch(url, init);
  responses.push(response);
  return response;
}

function post(body, headers = {}, url = ENDPOINT, redirect = "manual") {
  return send(url, {
    method: "POST",
    redirect,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function envelopeOf(response) {
  const text = await response.text();
  if (!(response.headers.get("content-type") ?? "").includes("event-stream")) {
    return JSON.parse(text);
  }
  const frame = text.split("\n").find((line) => line.startsWith("data: "));
  assert.ok(frame, `no data frame in ${text}`);
  return JSON.parse(frame.slice("data: ".length));
}

async function connect(options) {
  const client = new Client(
    { name: "asobeast-wire-check", version: "1.0.0" },
    options,
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    }),
  );
  return client;
}

function textOf(result) {
  return result.content?.[0]?.text ?? "";
}

before(async () => {
  clients.legacy = await connect();
  clients.modern = await connect({ versionNegotiation: { mode: "auto" } });
});

after(async () => {
  await Promise.all(Object.values(clients).map((client) => client.close()));
});

test("W01 connects and names the server", () => {
  assert.equal(clients.legacy.getServerVersion()?.name, "asobeast");
});

test("W02 negotiates the modern protocol era", () => {
  assert.equal(clients.modern.getProtocolEra(), "modern");
});

test("W03 lists exactly the read-only catalog in both eras", async () => {
  const expected = MCP_TOOLS.map((tool) => tool.name).sort();
  for (const client of Object.values(clients)) {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), expected);
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    }
  }
});

test("W04 answers a tool call with json in both eras", async () => {
  for (const client of Object.values(clients)) {
    const result = await client.callTool({ name: "list_apps", arguments: {} });
    assert.ok(!result.isError, textOf(result));
    assert.doesNotThrow(() => JSON.parse(textOf(result)));
  }
});

test("W05 reports a missing resource as a tool error", async () => {
  const result = await clients.legacy.callTool({
    name: "get_app",
    arguments: { appId: "wire-check-missing" },
  });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /not found/i);
});

test("W06 refuses an out of bounds argument as a tool error", async () => {
  const result = await clients.legacy.callTool({
    name: "list_reviews",
    arguments: { appId: "wire-check-missing", limit: 9999 },
  });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /200/);
});

test("W07 answers an unknown tool with invalid params", async () => {
  const response = await post({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "no_such_tool", arguments: {} },
  });
  const envelope = await envelopeOf(response);
  assert.equal(envelope.error?.code, -32602);
});

test("W08 refuses a client that does not accept an event stream", async () => {
  const response = await post(LIST_TOOLS, { accept: "application/json" });
  assert.equal(response.status, 406);
});

test("W09 refuses a body that is not json", async () => {
  const response = await post(LIST_TOOLS, { "content-type": "text/plain" });
  assert.equal(response.status, 415);
});

test("W10 accepts a notification with an empty 202", async () => {
  const response = await post({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
});

test("W11 refuses a protocol version it does not serve", async () => {
  const response = await post(LIST_TOOLS, {
    "mcp-protocol-version": "1999-01-01",
  });
  assert.equal(response.status, 400);
});

for (const [id, method] of [
  ["W12", "GET"],
  ["W13", "DELETE"],
]) {
  test(`${id} answers ${method} with 405 and names the allowed method`, async () => {
    const response = await send(ENDPOINT, {
      method,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        accept: "text/event-stream",
      },
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });
}

test("W14 challenges a request without a token", async () => {
  const response = await send(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(LIST_TOOLS),
  });
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /^Bearer/);
});

test("W15 accepts the bearer scheme in lowercase", async () => {
  const response = await post(LIST_TOOLS, { authorization: `bearer ${TOKEN}` });
  assert.equal(response.status, 200);
});

test("W16 answers oauth discovery with a json 404", async (t) => {
  const url = new URL(ENDPOINT);
  if (!url.pathname.startsWith("/api/backend/")) {
    t.skip("no web origin in front of the api");
    return;
  }
  const response = await send(
    `${url.origin}/.well-known/oauth-protected-resource`,
    { redirect: "manual" },
  );
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /json/);
});

test("W17 reaches the endpoint through a trailing slash", async () => {
  const response = await post(LIST_TOOLS, {}, `${ENDPOINT}/`, "follow");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray((await envelopeOf(response)).result?.tools));
});

test("W18 never issues a session", () => {
  for (const response of responses) {
    assert.equal(response.headers.get("mcp-session-id"), null, response.url);
  }
});
