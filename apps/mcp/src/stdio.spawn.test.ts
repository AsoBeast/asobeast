import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type ClientOptions } from "@modelcontextprotocol/client";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";
import { MCP_TOOLS } from "@asobeast/mcp-tools";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BINARY = join(PACKAGE_ROOT, "dist", "index.js");
const TOKEN = `asob_${"a".repeat(48)}`;
const SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

const OWNER = { id: "user-1", email: "owner@example.com", entitled: true };
const PLAN = { displayName: "Indie", limits: { mcpRequestsPerMinute: 60 } };
const SUMMARY = { appId: "app-1", trackedKeywords: 12, visibility: 41 };

const ROUTES: Record<string, unknown> = {
  "/auth/me": OWNER,
  "/auth/plan": PLAN,
  "/apps/app-1/summary": SUMMARY,
};

interface FakeApi {
  url: string;
  close: () => Promise<void>;
}

function buildBinary(): void {
  execFileSync(join(PACKAGE_ROOT, "node_modules", ".bin", "tsup"), {
    cwd: PACKAGE_ROOT,
    stdio: "ignore",
  });
}

function startFakeApi(): Promise<FakeApi> {
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Not authenticated" }));
      return;
    }
    const body = ROUTES[pathname];
    res.writeHead(body === undefined ? 404 : 200, {
      "content-type": "application/json",
    });
    res.end(JSON.stringify(body ?? { message: `${pathname} not found` }));
  });

  return new Promise<FakeApi>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((closed) => server.close(() => closed())),
      });
    });
  });
}

async function spawnClient(
  apiUrl: string,
  options?: ClientOptions,
  token = TOKEN,
): Promise<Client> {
  const client = new Client(
    { name: "asobeast-spawn-spec", version: "1.0.0" },
    options,
  );
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [BINARY],
      env: {
        ...getDefaultEnvironment(),
        ASOBEAST_API_URL: apiUrl,
        ASOBEAST_API_TOKEN: token,
      },
      stderr: "ignore",
    }),
  );
  return client;
}

interface ExitedBinary {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runBinary(env: Record<string, string>): Promise<ExitedBinary> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [BINARY],
      { env: { ...getDefaultEnvironment(), ...env } },
      (_error, stdout, stderr) => {
        resolve({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

function dialectOf(schema: unknown): unknown {
  return (schema as { $schema?: unknown }).$schema;
}

function textOf(result: { content?: unknown }): string {
  const [first] = (result.content ?? []) as { type: string; text: string }[];
  expect(first.type).toBe("text");
  return first.text;
}

let api: FakeApi;
let legacy: Client;
let modern: Client;

beforeAll(async () => {
  buildBinary();
  api = await startFakeApi();
  legacy = await spawnClient(api.url);
  modern = await spawnClient(api.url, {
    versionNegotiation: { mode: "auto" },
  });
}, 120_000);

afterAll(async () => {
  await Promise.all([legacy?.close(), modern?.close()]);
  await api?.close();
});

describe.each([
  ["legacy", () => legacy],
  ["modern", () => modern],
])("the stdio binary answering a %s client", (era, clientOf) => {
  it("negotiates that era", () => {
    expect(clientOf().getProtocolEra()).toBe(era);
  });

  it("lists exactly the shared catalog", async () => {
    const { tools } = await clientOf().listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOLS.map((tool) => tool.name).sort(),
    );
  });

  it("annotates every listed tool read only", async () => {
    const { tools } = await clientOf().listTools();

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("advertises every input schema in the 2020-12 dialect", async () => {
    const { tools } = await clientOf().listTools();

    for (const tool of tools) {
      expect(dialectOf(tool.inputSchema)).toBe(SCHEMA_DIALECT);
    }
  });

  it("reports the version the package manifest declares", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { version: string };

    expect(clientOf().getServerVersion()?.version).toBe(manifest.version);
  });

  it("answers a tool call with the payload the api returned", async () => {
    const result = await clientOf().callTool({
      name: "app_summary",
      arguments: { appId: "app-1" },
    });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe(JSON.stringify(SUMMARY, null, 2));
  });
});

describe("the stdio binary across both protocol eras", () => {
  it("advertises one identical tool contract", async () => {
    const [served, negotiated] = await Promise.all([
      legacy.listTools(),
      modern.listTools(),
    ]);

    expect(served.tools).toStrictEqual(negotiated.tools);
  });
});

describe("misconfigured", () => {
  it.each([
    [
      "an api url ending in /mcp",
      {
        ASOBEAST_API_URL: "https://host/api/backend/mcp",
        ASOBEAST_API_TOKEN: TOKEN,
      },
      "set it to https://host/api/backend.",
    ],
    [
      "an api url without a scheme",
      { ASOBEAST_API_URL: "host/api/backend", ASOBEAST_API_TOKEN: TOKEN },
      "ASOBEAST_API_URL must be an absolute http:// or https:// address",
    ],
    [
      "a token that is not a personal api token",
      {
        ASOBEAST_API_URL: "https://host/api/backend",
        ASOBEAST_API_TOKEN: "ghp_abc",
      },
      "ASOBEAST_API_TOKEN must be a personal API token starting with asob_",
    ],
  ])(
    "exits with a message naming the fix for %s",
    async (_case, env, message) => {
      const exited = await runBinary(env);

      expect(exited.code).toBe(1);
      expect(exited.stdout).toBe("");
      expect(exited.stderr).toContain(message);
    },
  );

  it("connects with a token pasted together with its bearer scheme", async () => {
    const client = await spawnClient(api.url, undefined, `Bearer ${TOKEN}`);

    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(MCP_TOOLS.length);
    } finally {
      await client.close();
    }
  });
});
