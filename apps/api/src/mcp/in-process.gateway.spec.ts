import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpAdapterHost } from '@nestjs/core';
import {
  InProcessGateway,
  dispatchGet,
  type RequestListener,
} from './in-process.gateway';

const TIMEOUT_MS = 50;

function gatewayFor(listener: RequestListener) {
  return {
    get: (url: string, headers: Record<string, string | undefined>) =>
      dispatchGet(listener, url, headers, TIMEOUT_MS),
  };
}

function json(status: number, body: unknown) {
  return (_req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
}

describe('InProcessGateway', () => {
  it('returns the parsed body a handler wrote', async () => {
    const gateway = gatewayFor(json(200, [{ id: 'app-1' }]));

    await expect(gateway.get('/apps', {})).resolves.toEqual({
      status: 200,
      body: [{ id: 'app-1' }],
    });
  });

  it('passes the caller credential through to the handler', async () => {
    const seen: Record<string, unknown> = {};
    const gateway = gatewayFor((req, res) => {
      seen.authorization = req.headers.authorization;
      seen.url = req.url;
      res.end('{}');
    });

    await gateway.get('/apps?country=us', { authorization: 'Bearer asob_x' });

    expect(seen).toEqual({
      authorization: 'Bearer asob_x',
      url: '/apps?country=us',
    });
  });

  it('carries an error status back rather than throwing', async () => {
    const gateway = gatewayFor(json(404, { message: 'App not found' }));

    await expect(gateway.get('/apps/missing', {})).resolves.toMatchObject({
      status: 404,
      body: { message: 'App not found' },
    });
  });

  it('reads a body a handler streamed in pieces', async () => {
    const gateway = gatewayFor((_req, res) => {
      res.write('{"a":');
      res.write('1}');
      res.end();
    });

    await expect(gateway.get('/apps', {})).resolves.toMatchObject({
      body: { a: 1 },
    });
  });

  it('treats an empty response as null rather than crashing', async () => {
    const gateway = gatewayFor((_req, res) => {
      res.statusCode = 204;
      res.end();
    });

    await expect(gateway.get('/apps', {})).resolves.toEqual({
      status: 204,
      body: null,
    });
  });

  it('keeps a non-json body as text', async () => {
    const gateway = gatewayFor((_req, res) => res.end('gateway down'));

    await expect(gateway.get('/apps', {})).resolves.toMatchObject({
      body: 'gateway down',
    });
  });

  it('answers rather than hanging when a handler never responds', async () => {
    const gateway = gatewayFor(() => undefined);

    await expect(gateway.get('/apps', {})).resolves.toMatchObject({
      status: 504,
    });
  });

  it('answers when a handler throws before writing anything', async () => {
    const gateway = gatewayFor(() => {
      throw new Error('router blew up');
    });

    await expect(gateway.get('/apps', {})).resolves.toMatchObject({
      status: 500,
    });
  });

  it('settles once even when a handler ends twice', async () => {
    const gateway = gatewayFor((_req, res) => {
      res.end('{"a":1}');
      res.end('{"b":2}');
    });

    await expect(gateway.get('/apps', {})).resolves.toMatchObject({
      body: { a: 1 },
    });
  });

  it('dispatches through the running http adapter', async () => {
    const adapterHost = {
      httpAdapter: { getInstance: () => json(200, { ok: true }) },
    } as unknown as HttpAdapterHost;

    await expect(
      new InProcessGateway(adapterHost).get('/health', {}),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } });
  });
});
