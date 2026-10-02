import './helpers/enable-auth';
import { execSync } from 'child_process';
import { request as httpRequest, type Server } from 'http';
import { AddressInfo, connect } from 'net';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import type { ApiErrorEnvelope, ApiTokenCreated } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ErrorTracking } from '../src/observability/error-tracking.service';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const BODY_LIMIT_BYTES = 102_400;
const HANG_UP_SETTLE_MS = 300;
const MCP_ACCEPT = 'application/json, text/event-stream';

const jsonOfBytes = (bytes: number): string => {
  const frame = JSON.stringify({ url: '' });
  return JSON.stringify({ url: 'x'.repeat(bytes - frame.length) });
};

interface RawResponse {
  status: number;
  body: ApiErrorEnvelope;
}

describe('Request body limits (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let port: number;
  let token: string;

  const post = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', MCP_ACCEPT);

  const postJson = (path: string, body: string) =>
    post(path).set('Content-Type', 'application/json').send(body);

  const rawPost = (
    headers: Record<string, string>,
    chunks: Buffer[],
  ): Promise<RawResponse> =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          port,
          path: '/apps',
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, ...headers },
        },
        (res) => {
          const received: Buffer[] = [];
          res.on('data', (chunk: Buffer) => received.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(received).toString();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: JSON.parse(text) as ApiErrorEnvelope,
              });
            } catch {
              reject(new Error(`expected a json envelope, got: ${text}`));
            }
          });
        },
      );
      req.on('error', reject);
      chunks.forEach((chunk) => req.write(chunk));
      req.end();
    });

  const expectEnvelope = (
    body: ApiErrorEnvelope,
    statusCode: number,
    error: string,
    path: string,
  ): void => {
    expect(body).toMatchObject({ statusCode, error, path });
    expect(typeof body.message).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await app.listen(0);
    port = ((app.getHttpServer() as Server).address() as AddressInfo).port;
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { suspendedAt: null, suspendedReason: null },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/register')
      .send({ email: 'limits@example.com', password: PASSWORD })
      .expect(201);
    const created = await owner
      .post('/auth/tokens')
      .send({ name: 'body limits', scope: 'write' })
      .expect(201);
    token = (created.body as ApiTokenCreated).token;
  }, 60_000);

  beforeEach(() => clearRateLimitCounters(app));

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it.each(['/apps', '/mcp'])(
    'answers a 413 envelope for a json body over the limit on %s',
    async (path) => {
      const response = await postJson(path, jsonOfBytes(200_000)).expect(413);

      expectEnvelope(
        response.body as ApiErrorEnvelope,
        413,
        'Payload Too Large',
        path,
      );
    },
  );

  it('answers 413 for a body of several megabytes', async () => {
    const response = await postJson(
      '/apps',
      jsonOfBytes(3 * 1024 * 1024),
    ).expect(413);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      413,
      'Payload Too Large',
      '/apps',
    );
  });

  it('accepts a body of exactly the limit', async () => {
    const response = await postJson(
      '/apps',
      jsonOfBytes(BODY_LIMIT_BYTES),
    ).expect(400);

    expect((response.body as ApiErrorEnvelope).message).not.toMatch(/large/i);
  });

  it('refuses a body one byte over the limit', async () => {
    await postJson('/apps', jsonOfBytes(BODY_LIMIT_BYTES + 1)).expect(413);
  });

  it('refuses an oversized body sent chunked with no content length', async () => {
    const chunk = Buffer.from('x'.repeat(50_000));
    const response = await rawPost(
      { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
      [Buffer.from('{"url":"'), chunk, chunk, chunk, Buffer.from('"}')],
    );

    expect(response.status).toBe(413);
    expectEnvelope(response.body, 413, 'Payload Too Large', '/apps');
  });

  it('refuses a small gzip body that inflates past the limit', async () => {
    const body = gzipSync(jsonOfBytes(2 * 1024 * 1024));
    expect(body.length).toBeLessThan(BODY_LIMIT_BYTES);

    const response = await rawPost(
      { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      [body],
    );

    expect(response.status).toBe(413);
    expectEnvelope(response.body, 413, 'Payload Too Large', '/apps');
  });

  it('refuses a form body over the limit', async () => {
    const response = await post('/apps')
      .type('form')
      .send(`url=${'x'.repeat(200_000)}`)
      .expect(413);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      413,
      'Payload Too Large',
      '/apps',
    );
  });

  it('refuses a form body with too many parameters', async () => {
    const parameters = Array.from(
      { length: 1001 },
      (_, index) => `p${index}=1`,
    ).join('&');

    const response = await post('/apps')
      .type('form')
      .send(parameters)
      .expect(413);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      413,
      'Payload Too Large',
      '/apps',
    );
  });

  it('answers 415 for a charset it cannot read', async () => {
    const response = await rawPost(
      { 'Content-Type': 'application/json; charset=latin1' },
      [Buffer.from('{"url":"x"}')],
    );

    expect(response.status).toBe(415);
    expectEnvelope(response.body, 415, 'Unsupported Media Type', '/apps');
  });

  it('answers 415 for a content encoding it cannot decode', async () => {
    const response = await rawPost(
      { 'Content-Type': 'application/json', 'Content-Encoding': 'compress' },
      [Buffer.from('{"url":"x"}')],
    );

    expect(response.status).toBe(415);
    expectEnvelope(response.body, 415, 'Unsupported Media Type', '/apps');
  });

  it('answers 400 for a gzip body that does not decompress', async () => {
    const response = await rawPost(
      { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      [Buffer.from('this is not gzip')],
    );

    expect(response.status).toBe(400);
    expectEnvelope(response.body, 400, 'Bad Request', '/apps');
  });

  it('still answers 400 for malformed json', async () => {
    const response = await postJson('/apps', '{"url":').expect(400);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      400,
      'Bad Request',
      '/apps',
    );
  });

  it('answers a body that is too large before it checks the credential', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .set('Content-Type', 'application/json')
      .send(jsonOfBytes(200_000))
      .expect(413);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      413,
      'Payload Too Large',
      '/apps',
    );
  });

  it('logs no error and reports nothing for an oversized body', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error');
    const reported = jest.spyOn(ErrorTracking.prototype, 'capture');

    await postJson('/apps', jsonOfBytes(200_000)).expect(413);

    expect(logged).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });

  it('logs no error and reports nothing when the client hangs up mid body', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error');
    const reported = jest.spyOn(ErrorTracking.prototype, 'capture');

    const socket = connect(port, '127.0.0.1');
    await new Promise<void>((resolve) => socket.once('connect', resolve));
    await new Promise<void>((resolve) =>
      socket.write(
        [
          'POST /apps HTTP/1.1',
          'Host: localhost',
          `Authorization: Bearer ${token}`,
          'Content-Type: application/json',
          'Content-Length: 5000',
          '',
          '{"url":"',
        ].join('\r\n'),
        () => resolve(),
      ),
    );
    socket.destroy();
    await new Promise((resolve) => setTimeout(resolve, HANG_UP_SETTLE_MS));

    expect(logged).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });
});
