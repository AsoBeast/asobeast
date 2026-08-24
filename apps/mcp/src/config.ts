import { z } from "zod";

const schema = z.object({
  ASOBEAST_API_URL: z.string().url().default("http://localhost:4000"),
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new ConfigError(message);
  }
  return {
    apiUrl: parsed.data.ASOBEAST_API_URL.replace(/\/+$/, ""),
    token: parsed.data.ASOBEAST_API_TOKEN,
  };
}
