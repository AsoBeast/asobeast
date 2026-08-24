import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import type { RequestRateLimiter } from '../auth/rate-limit/request-rate.limiter';
import { REDACTED } from '../common/logging/log-redaction';
import type { Env } from '../config/env';
import type { InProcessGateway } from './in-process.gateway';
import { McpBridge } from './mcp.bridge';

const TOKEN = `${API_TOKEN_PREFIX}${'b'.repeat(48)}`;

function bridgeFor(): McpBridge {
  return new McpBridge(
    {
      get: () => Promise.resolve({ status: 200, body: [] }),
    } as unknown as InProcessGateway,
    {} as RequestRateLimiter,
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

function jsonRpcRequest(): Request {
  const req = new IncomingMessage(new Socket());
  req.method = 'POST';
  req.url = '/mcp';
  req.headers['content-type'] = 'application/json';
  req.headers.accept = 'application/json, text/event-stream';
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

async function toolsList(bridge: McpBridge) {
  const recorded = recorder();
  await bridge.serve(jsonRpcRequest(), recorded.res, {
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
