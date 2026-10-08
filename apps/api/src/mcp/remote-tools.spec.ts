import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  MCP_TOOLS,
  MCP_WRITE_TOOLS,
  toolByName,
  toolText,
  type ReadTool,
  type ResolvedRequest,
} from '@asobeast/mcp-tools';
import type { ApiTokenScope } from '@asobeast/shared';
import { createRemoteServer, toolResult } from './remote-tools';

interface Answer {
  result?: {
    tools?: { name: string; annotations?: Record<string, unknown> }[];
    content?: { text: string }[];
    isError?: boolean;
  };
  error?: { code: number };
}

async function rpc(
  scope: ApiTokenScope | undefined,
  method: string,
  params: unknown = {},
  calls: ResolvedRequest[] = [],
): Promise<Answer> {
  const handler = createMcpHandler(
    () =>
      createRemoteServer(
        '1.0.0',
        (request) => {
          calls.push(request);
          return Promise.resolve({ status: 200, body: [] });
        },
        scope,
      ),
    { legacy: 'stateless' },
  );
  const response = await handler.fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  const frame = (await response.text())
    .split('\n')
    .find((line) => line.startsWith('data: '));
  await handler.close();
  return JSON.parse(frame!.slice('data: '.length)) as Answer;
}

function catalogTool(name: string): ReadTool {
  const tool = toolByName(name);
  if (!tool) throw new Error(`${name} is not in the mcp tool catalog`);
  return tool;
}

const tool = catalogTool('portfolio');

describe('toolResult', () => {
  it('answers with the same compact text the stdio server writes', () => {
    const body = {
      apps: [{ id: 'app-1', visibility: 41 }],
      totals: { apps: 1 },
    };

    const result = toolResult(tool, { status: 200, body });

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: toolText(body) }]);
  });

  it('answers null for an empty body', () => {
    const result = toolResult(tool, { status: 204, body: undefined });

    expect(result.content).toEqual([{ type: 'text', text: 'null' }]);
  });
});

describe('createRemoteServer', () => {
  it('lists only the read tools for a read scope', async () => {
    const answer = await rpc('read', 'tools/list');

    expect(answer.result?.tools?.map((tool) => tool.name)).toEqual(
      MCP_TOOLS.map((tool) => tool.name),
    );
  });

  it('lists only the read tools when no scope is given', async () => {
    const answer = await rpc(undefined, 'tools/list');

    expect(answer.result?.tools?.map((tool) => tool.name)).toEqual(
      MCP_TOOLS.map((tool) => tool.name),
    );
  });

  it('adds the write tools, with their hints, for a write scope', async () => {
    const answer = await rpc('write', 'tools/list');
    const tools = answer.result?.tools ?? [];

    expect(tools.map((tool) => tool.name)).toEqual([
      ...MCP_TOOLS.map((tool) => tool.name),
      ...MCP_WRITE_TOOLS.map((tool) => tool.name),
    ]);
    expect(
      tools.find((tool) => tool.name === 'untrack_keyword')?.annotations,
    ).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(
      tools.find((tool) => tool.name === 'list_apps')?.annotations,
    ).toEqual({ readOnlyHint: true });
  });

  it('executes a write tool as its method, path and body', async () => {
    const calls: ResolvedRequest[] = [];

    await rpc(
      'write',
      'tools/call',
      {
        name: 'track_keywords',
        arguments: { appId: 'app-1', keywords: ['habit'], country: 'us' },
      },
      calls,
    );

    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/apps/app-1/keywords',
        body: { keywords: ['habit'], country: 'us' },
      },
    ]);
  });

  it('does not know a write tool to a read scope and executes nothing', async () => {
    const calls: ResolvedRequest[] = [];

    const answer = await rpc(
      'read',
      'tools/call',
      {
        name: 'track_keywords',
        arguments: { appId: 'app-1', keywords: ['x'] },
      },
      calls,
    );

    expect(answer.error?.code).toBe(-32602);
    expect(calls).toEqual([]);
  });
});

describe('toolResult for a write tool', () => {
  const untrack = MCP_WRITE_TOOLS[1];

  it('confirms a delete the api answered with no body', () => {
    const result = toolResult(
      untrack,
      { status: 204, body: null },
      { appId: 'app-1', keywordId: 'kw-1' },
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: 'text',
        text: '{"removed":true,"appId":"app-1","keywordId":"kw-1"}',
      },
    ]);
  });

  it('reports a refusal from the write route as a tool error', () => {
    const result = toolResult(untrack, {
      status: 403,
      body: { message: 'This token is read-only.' },
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'This token is read-only.',
    );
  });
});
