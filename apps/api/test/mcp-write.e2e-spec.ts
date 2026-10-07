import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { API_TOKEN_PREFIX, type ActionItem } from '@asobeast/shared';
import { MCP_TOOLS, MCP_WRITE_TOOLS, annotationsOf } from '@asobeast/mcp-tools';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { InProcessGateway } from '../src/mcp/in-process.gateway';
import { createRemoteServer, urlOf } from '../src/mcp/remote-tools';
import { sha256 } from '../src/auth/password-hash';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { restoreAuthEnv } from './helpers/auth-env';
import { FakeRegistry, RIVAL_URL } from './helpers/mcp-fixtures';
import { mcpAs, textOf, type Envelope } from './helpers/mcp-rpc';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const READ_TOKEN = `${API_TOKEN_PREFIX}${'r'.repeat(48)}`;
const WRITE_TOKEN = `${API_TOKEN_PREFIX}${'w'.repeat(48)}`;
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.rival.app';

const isoDay = (offset: number): string =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('Remote MCP write tools (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let appStoreQueue: Queue;
  let reader: ReturnType<typeof mcpAs>;
  let writer: ReturnType<typeof mcpAs>;

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555000111',
        country: 'us',
        name: 'Write Fixture',
      },
    });

  const tracked = (appId: string) =>
    prisma.trackedKeyword.findMany({
      where: { appId },
      include: { keyword: true },
    });

  const queuedJobs = () =>
    appStoreQueue.getJobs(['wait', 'paused', 'delayed', 'waiting-children']);

  const callListedForWriteAsReader = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<Envelope> => {
    const gateway = app.get(InProcessGateway);
    const handler = createMcpHandler(
      () =>
        createRemoteServer(
          '1.0.0',
          (call) =>
            gateway.send({
              method: call.method,
              url: urlOf(call),
              headers: { authorization: `Bearer ${READ_TOKEN}` },
              body: call.body,
            }),
          'write',
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
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      }),
    );
    const frame = (await response.text())
      .split('\n')
      .find((line) => line.startsWith('data: '));
    await handler.close();
    return JSON.parse(frame!.slice('data: '.length)) as Envelope;
  };

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
      .useValue(new FakeRegistry())
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);
    appStoreQueue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { suspendedAt: null, suspendedReason: null },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'mcp-write@example.com', password: PASSWORD })
      .expect(201);
    for (const [token, scope] of [
      [READ_TOKEN, 'read'],
      [WRITE_TOKEN, 'write'],
    ] as const) {
      await prisma.apiToken.create({
        data: {
          userId: (owner.body as { id: string }).id,
          name: `mcp ${scope}`,
          tokenHash: sha256(token),
          prefix: token.slice(0, 12),
          scope,
        },
      });
    }
    reader = mcpAs(app, READ_TOKEN);
    writer = mcpAs(app, WRITE_TOKEN);
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await appStoreQueue.drain();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('lists exactly the read tools to a read-only token', async () => {
    const tools = await reader.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(
      MCP_TOOLS.map((tool) => tool.name),
    );
    for (const tool of tools) {
      expect(tool.annotations).toEqual({ readOnlyHint: true });
    }
  });

  it('lists the read tools then the write tools, with their hints, to a write token', async () => {
    const tools = await writer.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      ...MCP_TOOLS.map((tool) => tool.name),
      ...MCP_WRITE_TOOLS.map((tool) => tool.name),
    ]);
    for (const write of MCP_WRITE_TOOLS) {
      expect(
        tools.find((tool) => tool.name === write.name)?.annotations,
      ).toEqual(annotationsOf(write));
    }
  });

  describe('keywords', () => {
    it('tracks phrases as manual keywords and queues one scoring job each', async () => {
      const fixture = await seedApp();

      const result = await writer.callTool('track_keywords', {
        appId: fixture.id,
        keywords: ['Habit Tracker', 'streak counter'],
      });

      expect(result.result?.isError).toBeUndefined();
      const outcome = JSON.parse(textOf(result)) as {
        market: string;
        trackedInMarket: number;
        tracked: { keywordId: string; text: string; source: string }[];
      };
      expect(outcome.market).toBe('us');
      expect(outcome.tracked.map((item) => item.text).sort()).toEqual([
        'habit tracker',
        'streak counter',
      ]);
      expect(outcome.tracked.every((item) => item.source === 'MANUAL')).toBe(
        true,
      );
      expect((await tracked(fixture.id)).map((row) => row.source)).toEqual([
        'MANUAL',
        'MANUAL',
      ]);
      const jobs = await queuedJobs();
      expect(jobs.map((job) => job.name)).toEqual([
        JOBS.SCORE_KEYWORD,
        JOBS.SCORE_KEYWORD,
      ]);
    });

    it('leaves the same state the rest api leaves for the same phrases', async () => {
      const viaRest = await seedApp();
      await request(app.getHttpServer())
        .post(`/apps/${viaRest.id}/keywords`)
        .set('Authorization', `Bearer ${WRITE_TOKEN}`)
        .send({ keywords: ['Habit Tracker'] })
        .expect(201);
      const restRows = (await tracked(viaRest.id)).map(
        (row) => row.keyword.text,
      );
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
      );
      const viaMcp = await seedApp();

      await writer.callTool('track_keywords', {
        appId: viaMcp.id,
        keywords: ['Habit Tracker'],
      });

      expect((await tracked(viaMcp.id)).map((row) => row.keyword.text)).toEqual(
        restRows,
      );
    });

    it('tracks a phrase once however often it is asked for', async () => {
      const fixture = await seedApp();
      const call = () =>
        writer.callTool('track_keywords', {
          appId: fixture.id,
          keywords: ['habit tracker'],
        });

      await call();
      await call();

      expect(await tracked(fixture.id)).toHaveLength(1);
      expect(await queuedJobs()).toHaveLength(1);
    });

    it('tracks in the market it is told to and refuses one the store does not serve', async () => {
      const fixture = await seedApp();

      const german = await writer.callTool('track_keywords', {
        appId: fixture.id,
        keywords: ['gewohnheit'],
        country: 'de',
      });
      const unknown = await writer.callTool('track_keywords', {
        appId: fixture.id,
        keywords: ['habit'],
        country: 'zz',
      });

      expect(JSON.parse(textOf(german))).toMatchObject({ market: 'de' });
      expect((await tracked(fixture.id))[0]?.keyword.country).toBe('de');
      expect(unknown.result?.isError).toBe(true);
      expect(textOf(unknown)).toContain('zz');
    });

    it('refuses a phrase with a NUL character before anything is stored', async () => {
      const fixture = await seedApp();

      const result = await writer.callTool('track_keywords', {
        appId: fixture.id,
        keywords: ['habit\u0000tracker'],
      });

      expect(result.result?.isError).toBe(true);
      expect(await tracked(fixture.id)).toHaveLength(0);
    });

    it('stops tracking a keyword and says so, and reports it missing the second time', async () => {
      const fixture = await seedApp();
      const added = JSON.parse(
        textOf(
          await writer.callTool('track_keywords', {
            appId: fixture.id,
            keywords: ['habit tracker'],
          }),
        ),
      ) as { tracked: { keywordId: string }[] };
      const keywordId = added.tracked[0].keywordId;

      const first = await writer.callTool('untrack_keyword', {
        appId: fixture.id,
        keywordId,
      });
      const second = await writer.callTool('untrack_keyword', {
        appId: fixture.id,
        keywordId,
      });

      expect(JSON.parse(textOf(first))).toEqual({
        removed: true,
        appId: fixture.id,
        keywordId,
      });
      expect(await tracked(fixture.id)).toHaveLength(0);
      expect(second.result?.isError).toBe(true);
      expect(textOf(second)).toContain(`${keywordId} is not tracked`);
    });
  });

  describe('competitors', () => {
    it('adds a competitor once, refuses the other store, and removes it', async () => {
      const fixture = await seedApp();

      const first = await writer.callTool('add_competitor', {
        appId: fixture.id,
        url: RIVAL_URL,
      });
      const again = await writer.callTool('add_competitor', {
        appId: fixture.id,
        url: RIVAL_URL,
      });
      const wrongStore = await writer.callTool('add_competitor', {
        appId: fixture.id,
        url: PLAY_URL,
      });

      const added = JSON.parse(textOf(first)) as { id: string };
      expect(JSON.parse(textOf(again))).toMatchObject({ id: added.id });
      expect(
        await prisma.app.count({ where: { primaryAppId: fixture.id } }),
      ).toBe(1);
      expect(wrongStore.result?.isError).toBe(true);
      expect(textOf(wrongStore)).toContain('same store');

      const removed = await writer.callTool('remove_competitor', {
        appId: fixture.id,
        competitorId: added.id,
      });

      expect(JSON.parse(textOf(removed))).toMatchObject({ removed: true });
      expect(
        await prisma.app.count({ where: { primaryAppId: fixture.id } }),
      ).toBe(0);
    });
  });

  describe('actions', () => {
    const generateOne = async (): Promise<string> => {
      await seedUncoveredKeyword(prisma);
      await generateActionsAt(app, ACTION_DAY(0));
      const [action] = await prisma.actionItem.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID },
        select: { id: true },
      });
      return action.id;
    };

    it('snoozes, completes, dismisses and reopens an action under the token owner', async () => {
      const actionId = await generateOne();
      const owner = await prisma.user.findFirstOrThrow({
        where: { email: 'mcp-write@example.com' },
        select: { id: true },
      });
      const set = async (args: Record<string, unknown>) =>
        writer.callTool('set_action_status', { actionId, ...args });

      const snoozed = await set({
        status: 'SNOOZED',
        snoozedUntil: isoDay(10),
        note: 'revisit after the release',
      });
      const done = await set({ status: 'DONE' });
      const reopened = await set({ status: 'OPEN' });
      const dismissed = await set({
        status: 'DISMISSED',
        reason: 'not_relevant',
      });

      expect(JSON.parse(textOf(snoozed))).toMatchObject({
        id: actionId,
        status: 'SNOOZED',
        note: 'revisit after the release',
      });
      expect(JSON.parse(textOf(done))).toMatchObject({ status: 'DONE' });
      expect(JSON.parse(textOf(reopened))).toMatchObject({ status: 'OPEN' });
      expect(JSON.parse(textOf(dismissed))).toMatchObject({
        status: 'DISMISSED',
      });
      const events = await prisma.actionEvent.findMany({
        where: { actionId, actor: 'user' },
        select: { userId: true },
      });
      expect(events.length).toBeGreaterThanOrEqual(4);
      expect(events.every((event) => event.userId === owner.id)).toBe(true);
    });

    it.each([
      [
        'snoozing without a date',
        { status: 'SNOOZED' },
        'snoozedUntil is required',
      ],
      [
        'snoozing into the past',
        { status: 'SNOOZED', snoozedUntil: '2020-01-01' },
        'in the future',
      ],
      [
        'snoozing past the limit',
        { status: 'SNOOZED', snoozedUntil: isoDay(400) },
        'within 90 days',
      ],
      [
        'giving a reason without dismissing',
        { status: 'DONE', reason: 'not_relevant' },
        'only valid when status is DISMISSED',
      ],
    ])('reports %s as the api words it', async (_case, args, message) => {
      const actionId = await generateOne();

      const result = await writer.callTool('set_action_status', {
        actionId,
        ...args,
      });

      expect(result.result?.isError).toBe(true);
      expect(textOf(result)).toContain(message);
    });

    it('refuses to complete an action the system resolved', async () => {
      const actionId = await generateOne();
      await prisma.actionItem.update({
        where: { id: actionId },
        data: { status: 'RESOLVED' },
      });

      const result = await writer.callTool('set_action_status', {
        actionId,
        status: 'DONE',
      });

      expect(result.result?.isError).toBe(true);
      expect(textOf(result)).toContain('already closed');
    });

    it('reads back the same status through the rest api', async () => {
      const actionId = await generateOne();
      await writer.callTool('set_action_status', { actionId, status: 'DONE' });

      const viaRest = await request(app.getHttpServer())
        .get(`/actions/${actionId}`)
        .set('Authorization', `Bearer ${READ_TOKEN}`)
        .expect(200);

      expect((viaRest.body as ActionItem).status).toBe('DONE');
    });
  });

  it('does not know a write tool to a read-only token and changes nothing', async () => {
    const fixture = await seedApp();

    const response = await reader.rpc('tools/call', {
      name: 'track_keywords',
      arguments: { appId: fixture.id, keywords: ['habit tracker'] },
    });

    expect(JSON.stringify(response.body) + response.text).toContain('-32602');
    expect(await tracked(fixture.id)).toHaveLength(0);
    expect(await queuedJobs()).toHaveLength(0);
  });

  describe('a write tool listed by mistake to a read token', () => {
    const REFUSAL = 'This token is read-only.';

    it('is refused by the inner route and tracks nothing', async () => {
      const fixture = await seedApp();

      const answer = await callListedForWriteAsReader('track_keywords', {
        appId: fixture.id,
        keywords: ['habit tracker'],
      });

      expect(answer.result?.isError).toBe(true);
      expect(textOf(answer)).toContain(REFUSAL);
      expect(await tracked(fixture.id)).toHaveLength(0);
      expect(await queuedJobs()).toHaveLength(0);
    });

    it('is refused by the inner route and keeps the keyword tracked', async () => {
      const fixture = await seedApp();
      const added = JSON.parse(
        textOf(
          await writer.callTool('track_keywords', {
            appId: fixture.id,
            keywords: ['habit tracker'],
          }),
        ),
      ) as { tracked: { keywordId: string }[] };

      const answer = await callListedForWriteAsReader('untrack_keyword', {
        appId: fixture.id,
        keywordId: added.tracked[0].keywordId,
      });

      expect(answer.result?.isError).toBe(true);
      expect(textOf(answer)).toContain(REFUSAL);
      expect(await tracked(fixture.id)).toHaveLength(1);
    });
  });
});
