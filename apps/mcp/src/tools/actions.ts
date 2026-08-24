import { ACTION_TOOLS } from "@asobeast/mcp-tools";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ApiClient } from "../client.js";
import { registerReadTools } from "./define.js";

export function registerActionTools(
  server: McpServer,
  client: ApiClient,
): void {
  registerReadTools(server, client, ACTION_TOOLS);
}
