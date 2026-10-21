import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { ResponseTooLargeError } from '../bounded-body';
import { createGcsTransport, GcsUnreachableError } from './gcs-transport';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

describe('createGcsTransport', () => {
  let server: Server;
  let origin: string;
  let handler: Handler;
  const seen: { headers: IncomingMessage['headers']; body: string }[] = [];
  const transport = createGcsTransport({
    timeoutMs: 2_000,
    downloadTimeoutMs: 2_000,
  });

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

  it('posts the assertion as a form and reads the token', async () => {
    handler = (_, response) =>
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end('{"access_token":"ya29","expires_in":3600}');

    const answer = await transport({
      method: 'POST',
      url: `${origin}/token`,
      form: { grant_type: 'jwt', assertion: 'a.b.c' },
    });

    expect(answer.body).toEqual({ access_token: 'ya29', expires_in: 3600 });
    expect(seen[0].headers['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(seen[0].body).toBe('grant_type=jwt&assertion=a.b.c');
  });

  it('posts a json body with its content type', async () => {
    handler = (_, response) =>
      response.writeHead(200).end('{"result":{"replyText":"x"}}');

    const answer = await transport({
      method: 'POST',
      url: `${origin}/reply`,
      bearer: 'ya29',
      json: { replyText: 'x' },
    });

    expect(answer.body).toEqual({ result: { replyText: 'x' } });
    expect(seen[0].headers['content-type']).toBe('application/json');
    expect(seen[0].headers.authorization).toBe('Bearer ya29');
    expect(seen[0].body).toBe('{"replyText":"x"}');
  });

  it('lists with the bearer token', async () => {
    handler = (_, response) => response.writeHead(200).end('{"items":[]}');

    await transport({ method: 'GET', url: `${origin}/o`, bearer: 'ya29' });

    expect(seen[0].headers.authorization).toBe('Bearer ya29');
  });

  it('downloads media as bytes', async () => {
    handler = (_, response) =>
      response.writeHead(200).end(Buffer.from([0xff, 0xfe, 0x44, 0x00]));

    const answer = await transport({
      method: 'GET',
      url: `${origin}/media`,
      bearer: 'ya29',
      binary: true,
    });

    expect(answer.bytes).toEqual(Buffer.from([0xff, 0xfe, 0x44, 0x00]));
  });

  it('stops reading a download past its limit and asks for it as stored', async () => {
    handler = (_, response) => {
      response.writeHead(200);
      response.write(Buffer.alloc(3));
      response.end(Buffer.alloc(3));
    };

    await expect(
      transport({
        method: 'GET',
        url: `${origin}/media`,
        bearer: 'ya29',
        binary: true,
        maxBytes: 4,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(seen[0].headers['accept-encoding']).toBe('identity');
  });

  it('keeps the status and body of a refusal', async () => {
    handler = (_, response) =>
      response.writeHead(403).end('{"error":{"code":403}}');

    await expect(
      transport({ method: 'GET', url: `${origin}/o`, binary: true }),
    ).resolves.toMatchObject({ status: 403, body: { error: { code: 403 } } });
  });

  it('never follows a redirect', async () => {
    handler = (_, response) =>
      response.writeHead(302, { location: 'https://elsewhere.test/' }).end();

    await expect(
      transport({ method: 'GET', url: `${origin}/o` }),
    ).rejects.toBeInstanceOf(GcsUnreachableError);
  });
});
