import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import {
  annotationsOf,
  notFoundText,
  requestOf,
  toolOutput,
  withOutcomeNote,
  type McpTool,
} from "@asobeast/mcp-tools";
import type { ApiClient } from "../client.js";

export function registerCatalogTool(
  server: McpServer,
  client: ApiClient,
  def: McpTool,
): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: annotationsOf(def),
    },
    async (input): Promise<CallToolResult> => {
      const result = await client.request<unknown>(requestOf(def, input));
      if (!result.ok) {
        const message =
          result.status === 404
            ? notFoundText(def, result.message)
            : result.message;
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: withOutcomeNote(def, result.status, message),
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: toolOutput(def, input, result.data) }],
      };
    },
  );
}

export function registerCatalogTools(
  server: McpServer,
  client: ApiClient,
  tools: readonly McpTool[],
): void {
  for (const tool of tools) registerCatalogTool(server, client, tool);
}
