import type { McpServer } from "@modelcontextprotocol/server";
import type { ApiClient } from "../client.js";
import { registerAppTools } from "./apps.js";
import { registerKeywordTools } from "./keywords.js";
import { registerCompetitorTools } from "./competitors.js";
import { registerInsightTools } from "./insights.js";
import { registerActionTools } from "./actions.js";

export function registerTools(server: McpServer, client: ApiClient): void {
  registerAppTools(server, client);
  registerKeywordTools(server, client);
  registerCompetitorTools(server, client);
  registerInsightTools(server, client);
  registerActionTools(server, client);
}
