import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import {
  annotationsOf,
  requestOf,
  toolOutput,
  toolsFor,
  type McpTool,
  type ResolvedRequest,
  type ToolRequest,
} from '@asobeast/mcp-tools';
import type { ApiTokenScope } from '@asobeast/shared';
import type { InProcessResponse } from './in-process.gateway';
import { toolErrorText } from './tool-errors';

export const MCP_SERVER_NAME = 'asobeast';

export type ToolExecutor = (
  request: ResolvedRequest,
) => Promise<InProcessResponse>;

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
  tool: McpTool,
  response: InProcessResponse,
  input: Record<string, unknown> = {},
): CallToolResult {
  if (response.status >= 400) {
    return {
      isError: true,
      content: [{ type: 'text', text: toolErrorText(tool, response) }],
    };
  }
  return {
    content: [{ type: 'text', text: toolOutput(tool, input, response.body) }],
  };
}

export function createRemoteServer(
  version: string,
  execute: ToolExecutor,
  scope: ApiTokenScope = 'read',
): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version });
  for (const tool of toolsFor(scope)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: annotationsOf(tool),
      },
      async (input): Promise<CallToolResult> =>
        toolResult(tool, await execute(requestOf(tool, input)), input),
    );
  }
  return server;
}
