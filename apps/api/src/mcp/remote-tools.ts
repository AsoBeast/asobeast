import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import {
  MCP_TOOLS,
  type ReadTool,
  type ToolRequest,
} from '@asobeast/mcp-tools';
import type { InProcessResponse } from './in-process.gateway';
import { toolErrorText } from './tool-errors';

export const MCP_SERVER_NAME = 'asobeast';

export type ToolExecutor = (request: ToolRequest) => Promise<InProcessResponse>;

export function urlOf({ path, params }: ToolRequest): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }
  const search = query.toString();
  return search.length > 0 ? `${path}?${search}` : path;
}

export function toolResult(
  tool: ReadTool,
  response: InProcessResponse,
): CallToolResult {
  if (response.status >= 400) {
    return {
      isError: true,
      content: [{ type: 'text', text: toolErrorText(tool, response) }],
    };
  }
  return {
    content: [
      { type: 'text', text: JSON.stringify(response.body, null, 2) ?? 'null' },
    ],
  };
}

export function createRemoteServer(
  version: string,
  execute: ToolExecutor,
): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version });
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true },
      },
      async (input): Promise<CallToolResult> =>
        toolResult(tool, await execute(tool.request(input))),
    );
  }
  return server;
}
