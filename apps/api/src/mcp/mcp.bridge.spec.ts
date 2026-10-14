import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { BadRequestException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import type { ApiTokenScope } from '@asobeast/shared';
import type { RequestRateLimiter } from '../auth/rate-limit/request-rate.limiter';
import { REDACTED } from '../common/logging/log-redaction';
import type { Env } from '../config/env';
import type { InProcessGateway } from './in-process.gateway';
import { authInfoFor } from './mcp-auth-info';
import { McpBridge, messageCountOf } from './mcp.bridge';

const TOKEN = `${API_TOKEN_PREFIX}${'b'.repeat(48)}`;

function bridgeFor(limiter: Partial<RequestRateLimiter> = {}): McpBridge {
  return new McpBridge(
    {
      send: () => Promise.resolve({ status: 200, body: [] }),
    } as unknown as InProcessGateway,
    limiter as RequestRateLimiter,
    { get: () => false } as unknown as ConfigService<Env, true>,
  );
}

function recorder() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let status = 0;
  const res = {
    writeHead(code: number, sent?: Record<string, string>) {
      status = code;
      Object.assign(headers, sent);
      return res;
    },
    write(chunk: string | Uint8Array) {
      chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk?: string | Uint8Array) {
      if (chunk !== undefined) chunks.push(Buffer.from(chunk));
      return res;
    },
    on: () => res,
    destroyed: false,
  };
  return {
    res: res as unknown as Response,
    status: () => status,
    headers: () => headers,
    body: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function jsonRpcRequest(scope?: ApiTokenScope): Request {
  const req = new IncomingMessage(new Socket());
  req.method = 'POST';
  req.url = '/mcp';
  req.headers['content-type'] = 'application/json';
  req.headers.accept = 'application/json, text/event-stream';
  if (scope !== undefined) {
    (req as IncomingMessage & { auth?: unknown }).auth = authInfoFor(scope);
  }
  req.push(null);
  return req as unknown as Request;
}

function unreadableRequest(): Request {
  return {
    method: 'POST',
    url: '/mcp',
    get headers(): never {
      throw new Error(`conversion failed on Bearer ${TOKEN}`);
    },
  } as unknown as Request;
}

async function toolsList(bridge: McpBridge, scope?: ApiTokenScope) {
  const recorded = recorder();
  await bridge.serve(jsonRpcRequest(scope), recorded.res, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  });
  return recorded;
}

describe('McpBridge', () => {
  it('serves the catalog while the handler is open', async () => {
    const bridge = bridgeFor();

    const recorded = await toolsList(bridge);

    expect(recorded.status()).toBe(200);
    expect(recorded.body()).toContain('list_apps');

    await bridge.onModuleDestroy();
  });

  it('answers a legacy tool list over the 2025 event stream', async () => {
    const bridge = bridgeFor();

    const recorded = await toolsList(bridge);

    await bridge.onModuleDestroy();

    expect(recorded.headers()['content-type']).toContain('text/event-stream');
  });

  it('builds the handler without dropping mid-call messages', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const bridge = bridgeFor();
    const warned = warn.mock.calls.flat().join(' ');
    warn.mockRestore();
    await bridge.onModuleDestroy();

    expect(warned).not.toContain('responseMode');
  });

  it('stops serving once the module is destroyed', async () => {
    const silenced = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const bridge = bridgeFor();
    await bridge.onModuleDestroy();

    const recorded = await toolsList(bridge);
    silenced.mockRestore();

    expect(recorded.status()).toBe(500);
  });

  it('reports a transport failure instead of swallowing it', async () => {
    const reported = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const bridge = bridgeFor();
    await bridge.onModuleDestroy();

    await toolsList(bridge);
    const calls = reported.mock.calls.length;
    reported.mockRestore();

    expect(calls).toBeGreaterThan(0);
  });

  it('keeps a token out of a reported transport failure', async () => {
    const reported = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const bridge = bridgeFor();

    await bridge.serve(unreadableRequest(), recorder().res);
    const written = JSON.stringify(reported.mock.calls);
    reported.mockRestore();
    await bridge.onModuleDestroy();

    expect(written).toContain(REDACTED);
    expect(written).not.toContain(TOKEN);
  });
});

describe('McpBridge tool listing by token scope', () => {
  it.each([
    ['no auth info', undefined],
    ['a read scope', 'read' as const],
  ])('lists no write tool for %s', async (_case, scope) => {
    const bridge = bridgeFor();

    const recorded = await toolsList(bridge, scope);
    await bridge.onModuleDestroy();

    expect(recorded.body()).toContain('list_apps');
    expect(recorded.body()).not.toContain('track_keywords');
    expect(recorded.body()).not.toContain('set_action_status');
  });

  it('lists the write tools for a write scope', async () => {
    const bridge = bridgeFor();

    const recorded = await toolsList(bridge, 'write');
    await bridge.onModuleDestroy();

    for (const name of [
      'list_apps',
      'track_keywords',
      'untrack_keyword',
      'add_competitor',
      'remove_competitor',
      'set_action_status',
    ]) {
      expect(recorded.body()).toContain(name);
    }
  });

  it.each([
    ['write', ['write']],
    ['read', ['read']],
  ] as const)(
    'hands the token scope of a %s token to the handler',
    async (tokenScope, scopes) => {
      const consumeMcp = jest.fn(() => Promise.resolve());
      const bridge = bridgeFor({ consumeMcp });
      const req = {
        credential: 'token',
        tokenScope,
        user: { workspaceId: 'ws_1', workspace: null },
      } as unknown as Request;

      await bridge.admit(req);
      await bridge.onModuleDestroy();

      expect((req as Request & { auth?: { scopes: string[] } }).auth).toEqual({
        token: '',
        clientId: 'asobeast-personal-token',
        scopes,
      });
    },
  );

  it('falls back to read when the guard recorded no scope', async () => {
    const bridge = bridgeFor({ consumeMcp: jest.fn(() => Promise.resolve()) });
    const req = {
      credential: 'token',
      user: { workspaceId: 'ws_1', workspace: null },
    } as unknown as Request;

    await bridge.admit(req);
    await bridge.onModuleDestroy();

    expect(
      (req as Request & { auth?: { scopes: string[] } }).auth?.scopes,
    ).toEqual(['read']);
  });
});

describe('messageCountOf', () => {
  it.each([
    { label: 'a single request', body: { jsonrpc: '2.0', id: 1 }, count: 1 },
    { label: 'a missing body', body: undefined, count: 1 },
    { label: 'an empty batch', body: [], count: 1 },
    { label: 'a batch of one', body: [{ id: 1 }], count: 1 },
    { label: 'a batch of three', body: [{}, {}, {}], count: 3 },
  ])('counts $label as $count', ({ body, count }) => {
    expect(messageCountOf(body)).toBe(count);
  });
});

describe('McpBridge allowance', () => {
  const tokenRequest = (body: unknown) =>
    ({
      credential: 'token',
      body,
      user: { workspaceId: 'ws_1', workspace: null },
    }) as unknown as Request;

  it.each([
    { label: 'a single request', body: { jsonrpc: '2.0', id: 1 }, cost: 1 },
    { label: 'a batch of three', body: [{}, {}, {}], cost: 3 },
  ])('charges $label as $cost against the workspace', async (scenario) => {
    const consumeMcp = jest.fn(() => Promise.resolve());
    const bridge = bridgeFor({ consumeMcp });

    await bridge.admit(tokenRequest(scenario.body));
    await bridge.onModuleDestroy();

    expect(consumeMcp).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws_1' }),
      scenario.cost,
    );
  });

  it('refuses a batch the transport can never serve without charging it', async () => {
    const consumeMcp = jest.fn(() => Promise.resolve());
    const bridge = bridgeFor({ consumeMcp });

    await expect(
      bridge.admit(tokenRequest(Array.from({ length: 101 }, () => ({})))),
    ).rejects.toBeInstanceOf(BadRequestException);
    await bridge.onModuleDestroy();

    expect(consumeMcp).not.toHaveBeenCalled();
  });

  it('charges a batch of exactly 100 messages', async () => {
    const consumeMcp = jest.fn(() => Promise.resolve());
    const bridge = bridgeFor({ consumeMcp });

    await bridge.admit(tokenRequest(Array.from({ length: 100 }, () => ({}))));
    await bridge.onModuleDestroy();

    expect(consumeMcp).toHaveBeenCalledWith(expect.anything(), 100);
  });

  it('refuses a body nested deeper than the pipe allows without charging it', async () => {
    const consumeMcp = jest.fn(() => Promise.resolve());
    const bridge = bridgeFor({ consumeMcp });
    const nested = Array.from({ length: 65 }).reduce<unknown>(
      (inner) => [inner],
      [],
    );

    await expect(
      bridge.admit(tokenRequest({ jsonrpc: '2.0', params: nested })),
    ).rejects.toThrow('body must not be nested more than 64 levels deep');
    await bridge.onModuleDestroy();

    expect(consumeMcp).not.toHaveBeenCalled();
  });
});
