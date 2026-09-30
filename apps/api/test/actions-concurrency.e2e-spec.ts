import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ACTION_FORMULA_VERSION,
  ActionBulkUpdateResult,
  ActionItem,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ActionEventRecorder } from '../src/actions/action-events';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const LOCK_WAIT_MS = 300;
const CONCURRENT_REQUESTS = 5;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('Action transitions under concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;

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
      .useValue({
        get: () => {
          throw new Error('this suite must never touch a store');
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1234567890',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    appId = created.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedAction = async (
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const now = new Date();
    const row = await prisma.actionItem.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId,
        rule: 'metadata.fix_lint',
        category: 'metadata',
        store: Store.APP_STORE,
        country: 'us',
        fingerprint: `fp_${Math.random().toString(36).slice(2)}`,
        status: 'OPEN',
        priority: 'high',
        impact: 71,
        formulaVersion: ACTION_FORMULA_VERSION,
        evidence: {},
        firstSeenAt: now,
        lastSeenAt: now,
        ...overrides,
      },
    });
    return row.id;
  };

  const patch = (id: string, body: object) =>
    api
      .patch(`/actions/${id}`)
      .send(body)
      .then((res) => res);

  const bulkPatch = (ids: string[], body: object) =>
    api
      .patch('/actions')
      .send({ ids, ...body })
      .then((res) => res);

  const eventTypes = async (id: string): Promise<string[]> => {
    const events = await prisma.actionEvent.findMany({
      where: { actionId: id },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: { type: true },
    });
    return events.map((event) => event.type);
  };

  const holdNextEventWrite = () => {
    const recorder = app.get(ActionEventRecorder, { strict: false });
    const record = recorder.record.bind(recorder);
    let enter!: () => void;
    let release!: () => void;
    const inside = new Promise<void>((resolve) => (enter = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    jest
      .spyOn(recorder, 'record')
      .mockImplementationOnce(async (tx, events) => {
        await record(tx, events);
        enter();
        await released;
      });
    return { inside, release };
  };

  it('records one done event when a second done arrives while the first is still committing', async () => {
    const id = await seedAction();
    const held = holdNextEventWrite();

    const first = patch(id, { status: 'DONE' });
    await held.inside;
    const second = patch(id, { status: 'DONE' });
    await pause(LOCK_WAIT_MS);
    held.release();
    const [firstRes, secondRes] = await Promise.all([first, second]);

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect((secondRes.body as ActionItem).status).toBe('DONE');
    expect(await eventTypes(id)).toEqual(['done']);
  });

  it('records one done event when the same request is sent at once', async () => {
    const id = await seedAction();

    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        patch(id, { status: 'DONE' }),
      ),
    );

    expect(responses.map((res) => res.status)).toEqual(
      Array(CONCURRENT_REQUESTS).fill(200),
    );
    expect(await eventTypes(id)).toEqual(['done']);
  });

  it('counts one reopen when a closed action is reopened at once', async () => {
    const id = await seedAction({ status: 'DONE', closedAt: new Date() });

    await Promise.all(
      Array.from({ length: 3 }, () => patch(id, { status: 'OPEN' })),
    );

    expect(await eventTypes(id)).toEqual(['reopened']);
    const row = await prisma.actionItem.findUniqueOrThrow({
      where: { id },
      select: { reopenCount: true },
    });
    expect(row.reopenCount).toBe(1);
  });

  it('records one dismissal when the same reason is sent at once', async () => {
    const id = await seedAction();

    await Promise.all(
      Array.from({ length: 3 }, () =>
        patch(id, { status: 'DISMISSED', reason: 'not_relevant' }),
      ),
    );

    expect(await eventTypes(id)).toEqual(['dismissed']);
  });

  it('records one event per action when overlapping bulk closes arrive in opposite order', async () => {
    const ids = [await seedAction(), await seedAction(), await seedAction()];

    const responses = await Promise.all([
      bulkPatch(ids, { status: 'DONE' }),
      bulkPatch([...ids].reverse(), { status: 'DONE' }),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    for (const res of responses) {
      const body = res.body as ActionBulkUpdateResult;
      expect(body.items).toHaveLength(ids.length);
      expect(body.conflicts).toEqual([]);
    }
    for (const id of ids) {
      expect(await eventTypes(id)).toEqual(['done']);
    }
  });

  it('undoes once when undo arrives twice and refuses the second', async () => {
    const id = await seedAction();
    await patch(id, { status: 'DONE' });

    const responses = await Promise.all([
      patch(id, { status: 'OPEN', revert: true }),
      patch(id, { status: 'OPEN', revert: true }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    const row = await prisma.actionItem.findUniqueOrThrow({
      where: { id },
      select: { status: true, reopenCount: true },
    });
    expect(row).toEqual({ status: 'OPEN', reopenCount: 0 });
  });

  it('keeps both decisions when two different outcomes arrive at once', async () => {
    const id = await seedAction();

    await Promise.all([
      patch(id, { status: 'DONE' }),
      patch(id, { status: 'DISMISSED' }),
    ]);

    expect((await eventTypes(id)).sort()).toEqual(['dismissed', 'done']);
  });
});
