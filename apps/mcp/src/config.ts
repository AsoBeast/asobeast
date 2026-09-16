import { z } from "zod";

const DEFAULT_API_URL = "http://localhost:4000";
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const MCP_ENDPOINT_SUFFIX = "/mcp";

const schema = z.object({
  ASOBEAST_API_URL: z.string().optional(),
  ASOBEAST_API_TOKEN: z
    .string({
      error: "set ASOBEAST_API_TOKEN to a personal API token (asob_…)",
    })
    .min(1, "set ASOBEAST_API_TOKEN to a personal API token (asob_…)"),
});

export interface McpConfig {
  apiUrl: string;
  token: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function apiUrlOf(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_API_URL;
  const url = URL.canParse(value) ? new URL(value) : null;
  if (!url || !WEB_PROTOCOLS.has(url.protocol)) {
    throw new ConfigError(
      `ASOBEAST_API_URL must be an absolute http:// or https:// address such as https://your-host/api/backend, not "${value}".`,
    );
  }
  const base = value.replace(/\/+$/, "");
  if (base.endsWith(MCP_ENDPOINT_SUFFIX)) {
    throw new ConfigError(
      `ASOBEAST_API_URL points at the hosted MCP endpoint. The stdio server calls the REST API, so set it to ${base.slice(0, -MCP_ENDPOINT_SUFFIX.length)}.`,
    );
  }
  return base;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new ConfigError(message);
  }
  return {
    apiUrl: apiUrlOf(parsed.data.ASOBEAST_API_URL),
    token: parsed.data.ASOBEAST_API_TOKEN,
  };
}
