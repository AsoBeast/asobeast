import { toolsFor } from "@asobeast/mcp-tools";
import type { ApiTokenScope } from "@asobeast/shared";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ApiClient } from "../client.js";
import { registerCatalogTools } from "./define.js";

export function registerTools(
  server: McpServer,
  client: ApiClient,
  scope: ApiTokenScope = "read",
): void {
  registerCatalogTools(server, client, toolsFor(scope));
}
