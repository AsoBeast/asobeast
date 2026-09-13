import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { QuotaService } from '../src/auth/quota.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { KeywordsService } from '../src/keywords/keywords.service';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const PHRASE = 'focus timer';
const FIELD = 'focus timer,deep work,pomodoro';
const phraseSet = (word: string) =>
  Array.from({ length: 9 }, (_, index) => `${word} ${index}`);
const ALPHA_SET = phraseSet('alpha');
const DELTA_SET = phraseSet('delta');

const settlesWithin = (work: Promise<unknown>, ms: number) =>
  Promise.race([
    work.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

describe('Keyword writes under concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let keywords: KeywordsService;

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
    await app.init();
    await pauseQueues(app);
    keywords = app.get(KeywordsService);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await prisma.$disconnect();
  });

  const seedApp = async (storeAppId = 'concurrent') => {
    const row = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: 'Focus Timer',
      },
      select: { id: true },
    });
    return row.id;
  };

  const holdNextKeywordWrite = () => {
    const quota = app.get(QuotaService);
    const admit = quota.admitKeywordMarkets.bind(quota);
    let enter!: () => void;
    let release!: () => void;
    const inside = new Promise<void>((resolve) => (enter = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    jest.spyOn(quota, 'admitKeywordMarkets').mockImplementationOnce((write) =>
      admit(async (tx) => {
        const result = await write(tx);
        enter();
        await released;
        return result;
      }),
    );
    return { inside, release };
  };

  const trackedRows = (appId: string) =>
    prisma.trackedKeyword.findMany({
      where: { appId },
      select: {
        keywordId: true,
        source: true,
        active: true,
        keyword: { select: { text: true } },
      },
    });

  const activeTexts = async (appId: string) =>
    (await trackedRows(appId))
      .filter((row) => row.active)
      .map((row) => row.keyword.text)
      .sort();

  const waitForBlockedKeywordInsert = async () => {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
        SELECT COUNT(*) AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query LIKE 'INSERT INTO %"Keyword"%'
      `;
      if (waiting > 0n) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('The keyword insert never waited on the held row');
  };

  it('saves a keyword field while another writer inserts its new phrases in the opposite order', async () => {
    const appId = await seedApp();
    const keyword = (text: string) => ({
      text,
      store: Store.APP_STORE,
      country: 'us',
    });
    let saved!: ReturnType<typeof keywords.setKeywordField>;

    await prisma.$transaction(async (tx) => {
      await tx.keyword.create({ data: keyword('alpha') });
      saved = asWorkspace(app, () =>
        keywords.setKeywordField(appId, 'bravo,alpha'),
      );
      saved.catch(() => undefined);
      await waitForBlockedKeywordInsert();
      await tx.keyword.create({ data: keyword('bravo') });
    });

    const result = await saved;
    expect(result.tracked.map((item) => item.text)).toEqual(['bravo', 'alpha']);
  });

  it('adds the same phrase once when two requests arrive together', async () => {
    const appId = await seedApp();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.addManual(appId, [PHRASE]),
        keywords.addManual(appId, [PHRASE]),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);
    expect(await prisma.keyword.count({ where: { text: PHRASE } })).toBe(1);
    expect(await trackedRows(appId)).toHaveLength(1);
  });

  it('saves the same keyword field once when two saves arrive together', async () => {
    const appId = await seedApp();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.setKeywordField(appId, FIELD),
        keywords.setKeywordField(appId, FIELD),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);

    const rows = await trackedRows(appId);
    expect(rows).toHaveLength(FIELD.split(',').length);
    expect(rows.every((row) => row.active)).toBe(true);
    expect(rows.every((row) => row.source === 'KEYWORD_FIELD')).toBe(true);
  });

  it('keeps only one of two keyword fields saved at the same time', async () => {
    const appId = await seedApp();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.setKeywordField(appId, ALPHA_SET.join(',')),
        keywords.setKeywordField(appId, DELTA_SET.join(',')),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);

    const active = await activeTexts(appId);
    expect([ALPHA_SET, DELTA_SET]).toContainEqual(active);

    const stored = await asWorkspace(app, () =>
      keywords.getKeywordField(appId),
    );
    expect(stored.tracked.map((item) => item.text).sort()).toEqual(active);
    expect(stored.charactersUsed).toBeLessThanOrEqual(stored.charactersLimit);

    const reported = settled
      .filter((entry) => entry.status === 'fulfilled')
      .map((entry) => entry.value.tracked.map((item) => item.text).sort());
    for (const texts of reported) {
      expect([ALPHA_SET, DELTA_SET]).toContainEqual(texts);
    }
    expect(reported).toContainEqual(active);
  });

  it('leaves a manual keyword active when a keyword field save omits it', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));

    await asWorkspace(app, () => keywords.setKeywordField(appId, 'deep work'));

    expect(await trackedRows(appId)).toContainEqual(
      expect.objectContaining({
        active: true,
        source: 'MANUAL',
        keyword: { text: PHRASE },
      }),
    );
  });

  it('deactivates every keyword field phrase when the field is cleared', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.setKeywordField(appId, FIELD));

    await asWorkspace(app, () => keywords.setKeywordField(appId, ''));

    const rows = await trackedRows(appId);
    expect(rows).toHaveLength(FIELD.split(',').length);
    expect(rows.some((row) => row.active)).toBe(false);
  });

  it('makes a second save to the same app wait until the first commits', async () => {
    const appId = await seedApp();
    const hold = holdNextKeywordWrite();

    await asWorkspace(app, async () => {
      const first = keywords.setKeywordField(appId, ALPHA_SET.join(','));
      await hold.inside;
      const second = keywords.setKeywordField(appId, DELTA_SET.join(','));

      expect(await settlesWithin(second, 300)).toBe(false);
      hold.release();
      await Promise.all([first, second]);
    });

    expect(await activeTexts(appId)).toEqual(DELTA_SET);
  });

  it('lets another app save its keyword field while the first app is saving', async () => {
    const [firstId, secondId] = await Promise.all([
      seedApp('first'),
      seedApp('second'),
    ]);
    const hold = holdNextKeywordWrite();

    await asWorkspace(app, async () => {
      const first = keywords.setKeywordField(firstId, ALPHA_SET.join(','));
      await hold.inside;
      const second = keywords.setKeywordField(secondId, DELTA_SET.join(','));

      expect(await settlesWithin(second, 2_000)).toBe(true);
      hold.release();
      await Promise.all([first, second]);
    });

    expect(await activeTexts(firstId)).toEqual(ALPHA_SET);
    expect(await activeTexts(secondId)).toEqual(DELTA_SET);
  });

  it('leaves the keyword field of another app untouched', async () => {
    const [firstId, secondId] = await Promise.all([
      seedApp('first'),
      seedApp('second'),
    ]);

    await asWorkspace(app, () => keywords.setKeywordField(firstId, FIELD));
    await asWorkspace(app, () =>
      keywords.setKeywordField(secondId, 'deep work'),
    );

    expect(await activeTexts(firstId)).toEqual(FIELD.split(',').sort());
  });

  it('keeps the keyword field in the order it was typed', async () => {
    const appId = await seedApp();

    const result = await asWorkspace(app, () =>
      keywords.setKeywordField(appId, FIELD),
    );

    expect(result.tracked.map((item) => item.text)).toEqual(FIELD.split(','));
  });

  it('reads a saved keyword field back in the order of the latest save', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () =>
      keywords.setKeywordField(appId, 'pomodoro,deep work,focus timer'),
    );

    const saved = await asWorkspace(app, () =>
      keywords.setKeywordField(appId, FIELD),
    );
    const read = await asWorkspace(app, () => keywords.getKeywordField(appId));

    expect(saved.tracked.map((item) => item.text)).toEqual(FIELD.split(','));
    expect(read.tracked.map((item) => item.text)).toEqual(FIELD.split(','));
  });

  it('reactivates a deactivated keyword when it is added again', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));
    const [tracked] = await trackedRows(appId);
    await prisma.trackedKeyword.update({
      where: { appId_keywordId: { appId, keywordId: tracked.keywordId } },
      data: { active: false, source: 'TITLE' },
    });

    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));

    expect(await trackedRows(appId)).toEqual([
      expect.objectContaining({ active: true, source: 'TITLE' }),
    ]);
  });

  it('takes a keyword over for the keyword field when it is tracked elsewhere', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));

    await asWorkspace(app, () => keywords.setKeywordField(appId, PHRASE));

    expect(await trackedRows(appId)).toEqual([
      expect.objectContaining({ active: true, source: 'KEYWORD_FIELD' }),
    ]);
  });
});
