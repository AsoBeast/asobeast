import { INSIGHT_TOOLS } from "@asobeast/mcp-tools";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ApiClient } from "../client.js";
import { registerCatalogTools } from "./define.js";

export function registerInsightTools(
  server: McpServer,
  client: ApiClient,
): void {
  registerCatalogTools(server, client, INSIGHT_TOOLS);
}
