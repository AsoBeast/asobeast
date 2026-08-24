import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { createClient } from "../client.js";

export type ToolHandler = (
  input: Record<string, unknown>,
) => Promise<CallToolResult>;

export interface CapturedTool {
  config: {
    title?: string;
    description?: string;
    annotations?: { readOnlyHint?: boolean };
  };
  handler: ToolHandler;
}

export interface Harness {
  server: McpServer;
  tools: Map<string, CapturedTool>;
}

export function createHarness(): Harness {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool(
      name: string,
      config: CapturedTool["config"],
      handler: ToolHandler,
    ) {
      tools.set(name, { config, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

export interface FetchCall {
  url: string;
  headers: Record<string, string>;
}

export type StubResponse = { status: number; body: unknown } | "throw";

export interface StubbedFetch {
  calls: FetchCall[];
  client: ReturnType<typeof createClient>;
}

export function stubFetch(
  responder: (url: string) => StubResponse,
  token = "asob_secret_token",
): StubbedFetch {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: { ...(init?.headers as Record<string, string>) },
    });
    const result = responder(url);
    if (result === "throw") throw new Error("network down");
    if (result.status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return {
    calls,
    client: createClient({ apiUrl: "http://localhost:4000", token }),
  };
}
