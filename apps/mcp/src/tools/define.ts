import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import type { ReadTool } from "@asobeast/mcp-tools";
import type { ApiClient } from "../client.js";

export function registerReadTool(
  server: McpServer,
  client: ApiClient,
  def: ReadTool,
): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input): Promise<CallToolResult> => {
      const { path, params } = def.request(input);
      const result = await client.get<unknown>(path, params);
      if (!result.ok) {
        const message =
          result.status === 404 && def.unavailableOn404
            ? def.unavailableOn404
            : result.message;
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2) ?? "null",
          },
        ],
      };
    },
  );
}

export function registerReadTools(
  server: McpServer,
  client: ApiClient,
  tools: readonly ReadTool[],
): void {
  for (const tool of tools) registerReadTool(server, client, tool);
}
