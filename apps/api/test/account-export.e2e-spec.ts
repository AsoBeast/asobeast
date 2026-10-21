import './helpers/enable-auth';
import { execSync } from 'child_process';
import { EventEmitter } from 'node:events';
import { ServerResponse } from 'node:http';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { sha256 } from '../src/auth/password-hash';
import { EXPORT_PAGE_SIZE } from '../src/account/export-tables';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { seedApiToken, truncateUsers } from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const RESET_HASH = 'f'.repeat(64);
const DAY_MS = 86_400_000;
const PAST_THE_PAGE = 700;
const PROBE_COUNTRIES = ['us', 'gb', 'de'];
const CLAIM_TOKEN = 'claim-token-sentinel';
const CHECKOUT_SESSION = 'cs_test_sentinel';
const STRIPPED_KEYS = [
  'resetHash',
  'resetExpiresAt',
  'verificationExpiresAt',
  'sessionVersion',
  'checkoutClaimToken',
  'checkoutSessionId',
];

interface ExportLine {
  table?: string;
  row?: Record<string, unknown>;
}

const asText = (
  res: NodeJS.ReadableStream & { setEncoding(encoding: string): void },
  callback: (error: Error | null, body: string) => void,
): void => {
  let text = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => {
    text += chunk;
  });
  res.on('end', () => callback(null, text));
};

describe('Account export credential state (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let ownerCookie: string;
  let ownerReadToken: string;
  let memberReadToken: string;

  const exportAs = async (
    auth: { cookie: string } | { bearer: string },
    timeoutMs = 20_000,
  ): Promise<{ text: string; lines: ExportLine[] }> => {
    const call = request(app.getHttpServer())
      .get('/account/export')
      .timeout(timeoutMs);
    const response = await (
      'cookie' in auth
        ? call.set('Cookie', auth.cookie)
        : call.set('Authorization', `Bearer ${auth.bearer}`)
    )
      .buffer(true)
      .parse(asText)
      .expect(200);
    const text = response.body as string;
    return {
      text,
      lines: text
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ExportLine),
    };
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await truncateUsers(prisma);

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);
    ownerCookie = (
      registered.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    ownerReadToken = await seedApiToken(prisma, {
      seed: 'exportownerread',
      email: 'owner@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
      scope: 'read',
    });
    memberReadToken = await seedApiToken(prisma, {
      seed: 'exportmemberread',
      email: 'member@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });
    await prisma.user.update({
      where: { email: 'member@example.com' },
      data: {
        resetHash: RESET_HASH,
        resetExpiresAt: new Date(Date.now() + 3_600_000),
        verificationExpiresAt: new Date(Date.now() + 3_600_000),
        sessionVersion: 7,
      },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        billingCustomerId: 'cus_export_kept',
        checkoutClaimToken: CLAIM_TOKEN,
        checkoutSessionId: CHECKOUT_SESSION,
      },
    });
  });

  afterAll(async () => {
    await truncateUsers(prisma);
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  const principals = (): [
    string,
    { cookie: string } | { bearer: string },
  ][] => [
    ['the owner session', { cookie: ownerCookie }],
    ['the owner read token', { bearer: ownerReadToken }],
    ['a member read token', { bearer: memberReadToken }],
  ];

  it.each([0, 1, 2])(
    'leaves credential state out for principal %i',
    async (index) => {
      const [, auth] = principals()[index];

      const { text, lines } = await exportAs(auth);

      for (const sentinel of [RESET_HASH, CLAIM_TOKEN, CHECKOUT_SESSION]) {
        expect(text).not.toContain(sentinel);
      }
      for (const line of lines) {
        for (const key of STRIPPED_KEYS) {
          expect(Object.keys(line.row ?? {})).not.toContain(key);
        }
      }
    },
  );

  it('still exports every member and the billing facts of the workspace', async () => {
    const { lines } = await exportAs({ cookie: ownerCookie });

    const members = lines.filter((line) => line.table === 'user');
    expect(members.map((line) => line.row?.email).sort()).toEqual([
      'member@example.com',
      'owner@example.com',
    ]);
    expect(members[0].row).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        workspaceId: DEFAULT_WORKSPACE_ID,
        role: expect.any(String) as string,
        createdAt: expect.any(String) as string,
      }),
    );
    const workspace = lines.find((line) => line.table === 'workspace');
    expect(workspace?.row).toEqual(
      expect.objectContaining({
        id: DEFAULT_WORKSPACE_ID,
        billingCustomerId: 'cus_export_kept',
      }),
    );
  });

  it('keeps leaving out the secrets it always dropped', async () => {
    const { text } = await exportAs({ cookie: ownerCookie });

    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('tokenHash');
  });

  it('finishes when the response never emits drain', async () => {
    const owner = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@example.com' },
    });
    await prisma.apiToken.createMany({
      data: Array.from({ length: 400 }, (_, index) => ({
        userId: owner.id,
        name: `bulk ${index} ${'x'.repeat(240)}`,
        tokenHash: sha256(`bulk-export-${index}`),
        prefix: `bulk${index}`,
        scope: 'read',
      })),
    });
    const swallowDrain = jest
      .spyOn(ServerResponse.prototype, 'emit')
      .mockImplementation(function (
        this: ServerResponse,
        event: string | symbol,
        ...args: unknown[]
      ) {
        return event === 'drain'
          ? false
          : EventEmitter.prototype.emit.call(this, event, ...args);
      } as never);

    try {
      const { lines } = await exportAs({ cookie: ownerCookie }, 5_000);

      const manifest = lines[0] as unknown as {
        manifest: { tables: { table: string; rows: number }[] };
      };
      const rows = (table: string) =>
        lines.filter((line) => line.table === table).length;
      expect(rows('apiToken')).toBeGreaterThanOrEqual(400);
      for (const { table, rows: expected } of manifest.manifest.tables) {
        expect(rows(table)).toBe(expected);
      }
    } finally {
      swallowDrain.mockRestore();
      await prisma.apiToken.deleteMany({
        where: { name: { startsWith: 'bulk ' } },
      });
    }
  });

  it('writes every row of a compound key table once across page boundaries', async () => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: 'APP_STORE',
        storeAppId: '551000001',
        name: 'Paged Export',
      },
    });
    const keywordIds: string[] = [];
    try {
      const keywords = await Promise.all(
        ['paged one', 'paged two', 'paged three'].map((text) =>
          prisma.keyword.create({ data: { text, store: 'APP_STORE' } }),
        ),
      );
      keywordIds.push(...keywords.map((keyword) => keyword.id));
      const day = (offset: number) =>
        new Date(Date.UTC(2023, 0, 1) + offset * DAY_MS);
      const datesPerKeyword = Math.ceil(
        (EXPORT_PAGE_SIZE + PAST_THE_PAGE) / keywords.length,
      );
      const rankings = keywords.flatMap((keyword) =>
        Array.from({ length: datesPerKeyword }, (_, offset) => ({
          appId: app.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId: keyword.id,
          date: day(offset),
          position: offset % 200,
        })),
      );
      const probes = Array.from(
        { length: EXPORT_PAGE_SIZE + PAST_THE_PAGE },
        (_, index) => ({
          appId: app.id,
          term: 'habit',
          country: PROBE_COUNTRIES[index % PROBE_COUNTRIES.length],
          day: day(Math.floor(index / PROBE_COUNTRIES.length)),
          probe: 'h',
          results: [],
        }),
      );
      await prisma.keywordRanking.createMany({ data: rankings });
      await prisma.suggestProbe.createMany({ data: probes });

      const { lines } = await exportAs({ cookie: ownerCookie }, 60_000);

      const keysOf = (table: string, key: string[]) =>
        lines
          .filter((line) => line.table === table && line.row?.appId === app.id)
          .map((line) =>
            key.map((column) => String(line.row?.[column])).join('|'),
          );
      const rankingKeys = keysOf('keywordRanking', ['keywordId', 'date']);
      const probeKeys = keysOf('suggestProbe', ['country', 'day']);
      expect(rankingKeys).toHaveLength(rankings.length);
      expect(new Set(rankingKeys).size).toBe(rankings.length);
      expect(probeKeys).toHaveLength(probes.length);
      expect(new Set(probeKeys).size).toBe(probes.length);
    } finally {
      await prisma.app.delete({ where: { id: app.id } });
      await prisma.keyword.deleteMany({ where: { id: { in: keywordIds } } });
    }
  });
});
