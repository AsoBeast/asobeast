import './helpers/enable-open-registration';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import type { ApiErrorEnvelope } from '@asobeast/shared';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { restoreAuthEnv } from './helpers/auth-env';
import { seedApiToken, truncateUsers } from './helpers/api-tokens';
import { ownerAgent } from './helpers/session';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const NUL = '\u0000';
const SWEEP_ID = 'a%00b';
const PASSWORD = 'supersecret2';

const stranger = (label: string) => ({
  email: `${label}@example.com`,
  password: PASSWORD,
});
const MCP_ACCEPT = 'application/json, text/event-stream';
const nestedArrays = (levels: number) =>
  `${'['.repeat(levels)}${']'.repeat(levels)}`;
const LISTING_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';

const IMPORTED: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Imported Fixture',
  description: 'Imported fixture description',
  raw: { source: 'fixture' },
  searchable: true,
};

class CountingRegistry {
  getAppCalls = 0;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) => {
        this.getAppCalls += 1;
        return Promise.resolve({ ...IMPORTED, store, storeAppId });
      },
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      availability: (_id: string, countries: string[]) =>
        Promise.resolve(
          countries.map((country) => ({
            country,
            status: 'available' as const,
          })),
        ),
    } as unknown as StoreProvider;
  }
}

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ExpressRoute {
  path: string;
  methods: Record<string, boolean>;
}

interface ExpressRouter {
  router: { stack: { route?: ExpressRoute }[] };
}

function envelope(response: Response): ApiErrorEnvelope {
  return response.body as ApiErrorEnvelope;
}

function toolResult(response: Response) {
  const frame = response.text
    .split('\n')
    .find((line) => line.startsWith('data: '));
  return (
    JSON.parse(frame!.slice('data: '.length)) as {
      result: { isError?: boolean; content: { text: string }[] };
    }
  ).result;
}

describe('A NUL character in a request (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;
  let keywordId: string;
  let token: string;
  let errorLog: jest.SpyInstance;
  const registry = new CountingRegistry();

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    configureAdminSurfaces(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { suspendedAt: null, suspendedReason: null },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await truncateUsers(prisma);
    owner = await ownerAgent(app);
    token = await seedApiToken(prisma, {
      seed: 'nulcharacter',
      email: 'mcp@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
    });
    const seeded = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '777000111',
        country: 'us',
        name: 'Nul Fixture',
      },
    });
    appId = seeded.id;
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    keywordId = keyword.id;
    await prisma.trackedKeyword.create({
      data: { appId, keywordId, source: 'MANUAL' },
    });
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorLog.mockRestore());

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  describe('in a path id', () => {
    it.each([
      ['an id that ends in a NUL', '/apps/abc%00/keywords'],
      ['an id with a NUL inside', '/apps/a%00b'],
      ['a keyword id', '/keywords/a%00b/serp'],
    ])('answers 404 for %s', async (_name, path) => {
      const response = await owner.get(path).expect(404);

      expect(envelope(response)).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Resource not found',
        path,
      });
      expect(JSON.stringify(response.body)).not.toContain('u0000');
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('answers 404 for a NUL id on a write', async () => {
      await owner.delete('/apps/a%00b').expect(404);
      await owner.post('/apps/a%00b/refresh').expect(404);
      await owner.delete('/webhooks/a%00b').expect(404);
    });

    it('answers 404 for a NUL in the second id of a nested route', async () => {
      await owner.delete(`/apps/${appId}/keywords/a%00b`).expect(404);
    });

    it('treats an encoded percent sign as the text it is', async () => {
      const response = await owner.get('/apps/a%2500b').expect(404);

      expect(envelope(response).message).toBe('App a%00b not found');
    });

    it('answers a caller with no session 401 before it looks at the id', async () => {
      await request(app.getHttpServer()).get('/apps/a%00b').expect(401);
    });

    it('never answers 500 for a NUL in the id of any route that takes one', async () => {
      const stack = (app.getHttpAdapter().getInstance() as ExpressRouter).router
        .stack;
      const probed: string[] = [];
      for (const { route } of stack) {
        if (!route?.path.includes(':')) continue;
        for (const verb of Object.keys(route.methods) as Verb[]) {
          await clearRateLimitCounters(app);
          const path = route.path.replace(/:[A-Za-z]+/g, SWEEP_ID);
          const sent = owner[verb](path);
          const response = await (verb === 'get' || verb === 'delete'
            ? sent
            : sent.send({ confirm: true, reason: 'checking a nul id' }));
          if (response.status >= 500) {
            probed.push(
              `${response.status} ${verb.toUpperCase()} ${route.path}`,
            );
          }
        }
      }

      expect(probed).toEqual([]);
    });
  });

  describe('in a query value', () => {
    it('answers 400 for a review version filter', async () => {
      const response = await owner
        .get(`/apps/${appId}/reviews?version=%00`)
        .expect(400);

      expect(envelope(response)).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'version must not contain a NUL character',
      });
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('answers 400 for a NUL inside a repeated query value', async () => {
      const response = await owner
        .get(`/apps/${appId}/reviews?version=1.0&version=2%00`)
        .expect(400);

      expect(envelope(response).message).toBe(
        'version[1] must not contain a NUL character',
      );
    });

    it('answers 400 for an operator directory filter', async () => {
      const response = await owner
        .get('/admin/support/users?workspaceId=%00')
        .expect(400);

      expect(envelope(response).message).toBe(
        'workspaceId must not contain a NUL character',
      );
    });
  });

  describe('in a body field', () => {
    it('answers 400 for a keyword note', async () => {
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note: `a${NUL}b` })
        .expect(400);

      expect(envelope(response)).toMatchObject({
        statusCode: 400,
        message: 'note must not contain a NUL character',
      });
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('answers 400 for a webhook url', async () => {
      const response = await owner
        .post('/webhooks')
        .send({ url: `https://example.com/${NUL}`, events: ['rank.dropped'] })
        .expect(400);

      expect(envelope(response).message).toBe(
        'url must not contain a NUL character',
      );
    });

    it('names the element of a list that holds the NUL', async () => {
      const response = await owner
        .post(`/apps/${appId}/keywords`)
        .send({ keywords: ['fine', `bad${NUL}`] })
        .expect(400);

      expect(envelope(response).message).toBe(
        'keywords[1] must not contain a NUL character',
      );
    });

    it('answers 400 for a keyword field text', async () => {
      await owner
        .put(`/apps/${appId}/keyword-field`)
        .send({ text: `a,b${NUL}` })
        .expect(400);
    });

    it('answers 400 for a NUL in a form encoded body', async () => {
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .type('form')
        .send('note=a%00b')
        .expect(400);

      expect(envelope(response).message).toBe(
        'note must not contain a NUL character',
      );
    });

    it('stores nothing from a refused write', async () => {
      const before = await prisma.trackedKeyword.findFirstOrThrow({
        where: { appId, keywordId },
      });
      await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note: `kept${NUL}` })
        .expect(400);

      const row = await prisma.trackedKeyword.findFirstOrThrow({
        where: { appId, keywordId },
      });
      expect(row.note).toBe(before.note);
    });
  });

  describe('in a store url', () => {
    it.each([
      [
        'a NUL',
        LISTING_URL.replace('fixture', `fixture${NUL}`),
        'url must not contain a NUL character',
      ],
      [
        'a lone surrogate',
        LISTING_URL.replace('fixture', 'fixture\ud83d'),
        'url must be well formed Unicode text',
      ],
    ])(
      'answers 400 for %s in an import url and stores nothing',
      async (_name, url, message) => {
        const apps = await prisma.app.count();

        const response = await owner.post('/apps').send({ url }).expect(400);

        expect(envelope(response).message).toBe(message);
        expect(registry.getAppCalls).toBe(0);
        await expect(prisma.app.count()).resolves.toBe(apps);
      },
    );
  });

  describe('on an anonymous route', () => {
    it('answers 400 for a NUL in the registration name and creates nothing', async () => {
      const users = await prisma.user.count();
      const workspaces = await prisma.workspace.count();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...stranger('nul-name'), name: `N${NUL}` })
        .expect(400);

      expect(envelope(response)).toMatchObject({
        statusCode: 400,
        message: 'name must not contain a NUL character',
      });
      expect(errorLog).not.toHaveBeenCalled();
      await expect(prisma.user.count()).resolves.toBe(users);
      await expect(prisma.workspace.count()).resolves.toBe(workspaces);
    });

    it('registers a password that holds a NUL and signs the account in with it', async () => {
      const account = {
        email: stranger('nul-password').email,
        password: `long${NUL}enough1`,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(account)
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(account)
        .expect(200);
    });

    it('answers a wrong password that holds a NUL 401, not 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: stranger('nul-password').email, password: `x${NUL}` })
        .expect(401);
    });

    it('does not inspect a password change or the one time tokens', async () => {
      const email = stranger('nul-change').email;
      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: PASSWORD })
        .expect(201);
      const cookie = (
        registered.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];
      const token = `${'a'.repeat(16)}${NUL}`;

      await request(app.getHttpServer())
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ current: `wrong${NUL}`, next: PASSWORD })
        .expect(401);
      const changed = await request(app.getHttpServer())
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ current: PASSWORD, next: `new${NUL}password1` });
      const reset = await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token, password: `new${NUL}password1` });
      const confirm = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token });
      const invite = await request(app.getHttpServer())
        .post('/workspace/invites/accept')
        .send({ token, password: `new${NUL}password1` });

      expect(changed.status).toBe(200);
      for (const response of [reset, confirm, invite]) {
        expect(response.status).toBeLessThan(500);
        expect(envelope(response).message).not.toContain('NUL');
      }
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: `new${NUL}password1` })
        .expect(200);
    });

    it('still registers a name with an emoji and other control characters', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...stranger('emoji-name'), name: 'Zoe\t\u0001 \u{1F600}' })
        .expect(201);

      expect((response.body as { name: string }).name).toBe(
        'Zoe\t\u0001 \u{1F600}',
      );
    });
  });

  describe('in a body nested deeper than validation can walk', () => {
    it('answers 400 for an anonymous registration and creates nothing', async () => {
      const users = await prisma.user.count();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send(
          `{"email":"deep-name@example.com","password":"${PASSWORD}","name":${nestedArrays(40_000)}}`,
        )
        .expect(400);

      expect(envelope(response)).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'body must not be nested more than 64 levels deep',
      });
      expect(errorLog).not.toHaveBeenCalled();
      await expect(prisma.user.count()).resolves.toBe(users);
    });

    it('keeps the validation message for a body within the limit', async () => {
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .set('Content-Type', 'application/json')
        .send(`{"note":${nestedArrays(8)}}`)
        .expect(400);

      expect(envelope(response).message).toContain('note must be a string');
    });
  });

  describe('on an operator route', () => {
    it('answers 404 for a NUL in the workspace id of an action', async () => {
      const response = await owner
        .post('/admin/support/workspaces/ws_default%00/suspend')
        .send({ confirm: true, reason: 'checking a nul id' })
        .expect(404);

      expect(envelope(response).message).toBe('Resource not found');
      await expect(
        prisma.workspace.findUniqueOrThrow({
          where: { id: DEFAULT_WORKSPACE_ID },
        }),
      ).resolves.toMatchObject({ suspendedAt: null });
    });

    it('answers 404 for a NUL in the workspace id of the detail view', async () => {
      await owner.get('/admin/support/workspaces/ws_default%00').expect(404);
    });
  });

  describe('through the MCP endpoint', () => {
    const call = (name: string, args: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .set('Accept', MCP_ACCEPT)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        });

    it('reports a NUL app id as a tool error that is not a server failure', async () => {
      const response = await call('get_app', { appId: `a${NUL}b` }).expect(200);
      const result = toolResult(response);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Resource not found');
    });

    it('reports a NUL query argument as a tool error that is not a server failure', async () => {
      const response = await call('list_reviews', {
        appId,
        version: `1${NUL}`,
      }).expect(200);
      const result = toolResult(response);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'version must not contain a NUL character',
      );
    });

    it('still serves a tool call whose arguments are clean', async () => {
      const response = await call('get_app', { appId }).expect(200);

      expect(toolResult(response).isError).toBeUndefined();
    });
  });

  describe('input the database can store', () => {
    it('accepts an emoji and the other control characters in a note', async () => {
      const note = 'tab\t bell\u0007 \u{1F600} soh\u0001';
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note })
        .expect(200);

      expect((response.body as { note: string }).note).toBe(note);
    });

    it.each([
      ['a lone high surrogate', 'a\ud83d'],
      ['a lone low surrogate', 'a\ude00b'],
      ['surrogates in the wrong order', '\ude00\ud83d'],
    ])('answers 400 for %s in a body field', async (_name, note) => {
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note })
        .expect(400);

      expect(envelope(response).message).toBe(
        'note must be well formed Unicode text',
      );
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('accepts a surrogate pair as the emoji it spells', async () => {
      await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note: 'pair \ud83d\ude00' })
        .expect(200);
    });

    it('still registers a password with a lone surrogate and signs in with it', async () => {
      const account = {
        email: stranger('surrogate-password').email,
        password: 'long\ud83denough1',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(account)
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(account)
        .expect(200);
    });

    it('accepts a query value with an encoded percent sign and a plus', async () => {
      await owner.get(`/apps/${appId}/reviews?version=%2500%2B1`).expect(200);
    });

    it('keeps the 400 a failing validator already gives', async () => {
      const response = await owner
        .patch(`/apps/${appId}/keywords/${keywordId}`)
        .send({ note: 12 })
        .expect(400);

      expect(envelope(response).message).toContain('note must be a string');
    });
  });
});
