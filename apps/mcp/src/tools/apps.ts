import { APP_TOOLS } from "@asobeast/mcp-tools";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ApiClient } from "../client.js";
import { registerReadTools } from "./define.js";

export function registerAppTools(server: McpServer, client: ApiClient): void {
  registerReadTools(server, client, APP_TOOLS);
}
