import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { AscUnreachableError } from './asc-errors';
import { ASC_ORIGIN, createAscTransport } from './asc-transport';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

describe('createAscTransport', () => {
  let server: Server;
  let origin: string;
  let handler: Handler;
  const seen: { headers: IncomingMessage['headers']; body: string }[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        seen.push({ headers: request.headers, body });
        handler(request, response);
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    seen.length = 0;
  });

  const transport = (timeoutMs = 2_000) =>
    createAscTransport({ origin, timeoutMs, downloadTimeoutMs: timeoutMs });

  it('talks to App Store Connect by default', () => {
    expect(ASC_ORIGIN).toBe('https://api.appstoreconnect.apple.com');
  });

  it('sends the bearer token and accept header and parses a JSON body', async () => {
    handler = (_, response) =>
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end('{"data":[{"id":"1"}]}');

    await expect(
      transport()({ method: 'GET', path: '/v1/apps?limit=1', token: 'jwt' }),
    ).resolves.toEqual({
      status: 200,
      body: { data: [{ id: '1' }] },
      retryAfter: null,
    });
    expect(seen[0].headers.authorization).toBe('Bearer jwt');
    expect(seen[0].headers.accept).toBe('application/json');
  });

  it('sends a json body with its content type', async () => {
    handler = (_, response) => response.writeHead(201).end('{}');

    await transport()({
      method: 'POST',
      path: '/v1/analyticsReportRequests',
      token: 'jwt',
      body: { data: { type: 'analyticsReportRequests' } },
    });

    expect(seen[0].headers['content-type']).toBe('application/json');
    expect(seen[0].body).toBe('{"data":{"type":"analyticsReportRequests"}}');
  });

  it('answers null for an empty body', async () => {
    handler = (_, response) => response.writeHead(204).end();

    await expect(
      transport()({ method: 'DELETE', path: '/v1/x', token: 'jwt' }),
    ).resolves.toMatchObject({ status: 204, body: null });
  });

  it('reports a non JSON body as null and keeps the status and retry after', async () => {
    handler = (_, response) =>
      response.writeHead(503, { 'retry-after': '30' }).end('<html>bad</html>');

    await expect(
      transport()({ method: 'GET', path: '/v1/apps', token: 'jwt' }),
    ).resolves.toEqual({ status: 503, body: null, retryAfter: '30' });
  });

  it('downloads an absolute url as bytes without the bearer token', async () => {
    handler = (_, response) =>
      response.writeHead(200).end(Buffer.from([0x1f, 0x8b, 0x08]));

    const answer = await transport()({
      method: 'GET',
      path: '',
      absoluteUrl: `${origin}/segment.csv.gz`,
    });

    expect(answer.status).toBe(200);
    expect(answer.bytes).toEqual(Buffer.from([0x1f, 0x8b, 0x08]));
    expect(seen[0].headers.authorization).toBeUndefined();
  });

  it('times out at the configured bound', async () => {
    handler = () => undefined;

    await expect(
      transport(50)({ method: 'GET', path: '/v1/apps', token: 'jwt' }),
    ).rejects.toBeInstanceOf(AscUnreachableError);
  });

  it('never follows a redirect', async () => {
    handler = (_, response) =>
      response.writeHead(302, { location: 'https://elsewhere.test/' }).end();

    await expect(
      transport()({ method: 'GET', path: '/v1/apps', token: 'jwt' }),
    ).rejects.toBeInstanceOf(AscUnreachableError);
  });
});
