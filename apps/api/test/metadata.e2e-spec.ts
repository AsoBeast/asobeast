import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  MetadataAssistantResult,
  MetadataAssistantStatus,
  MetadataAuditResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { AiClient, OPENAI_CLIENT } from '../src/ai/openai.client';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const D0 = new Date('2026-07-01T00:00:00.000Z');

const fakeAiClient: AiClient = {
  model: 'gpt-4o',
  structured: jest.fn().mockResolvedValue({
    drafts: [
      {
        field: 'title',
        value: 'Habit Tracker: Daily Goals',
        rationale: 'Adds the primary keyword.',
      },
      {
        field: 'subtitle',
        value: 'Sleep Timer & Water Log',
        rationale: 'Secondary keywords with no title repeats.',
      },
      {
        field: 'keywordField',
        value: 'goal,water,reminder,sleep',
        rationale: 'Covers uncovered terms in singular form.',
      },
    ],
  }),
};

describe('MetadataController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(fakeAiClient)
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async (withKeywordField: boolean): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1234567890',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Habit Tracker',
        subtitle: 'Daily Streak Counter',
        description: 'Build better habits.',
        raw: {},
        capturedAt: D0,
      },
    });

    const rows: Array<{
      text: string;
      source: 'MANUAL' | 'KEYWORD_FIELD';
      traffic: number;
      difficulty: number;
    }> = [
      { text: 'habit tracker', source: 'MANUAL', traffic: 8, difficulty: 3 },
      { text: 'daily goals', source: 'MANUAL', traffic: 7, difficulty: 2 },
      { text: 'sleep timer', source: 'MANUAL', traffic: 6, difficulty: 4 },
    ];
    if (withKeywordField) {
      rows.push({
        text: 'water reminder',
        source: 'KEYWORD_FIELD',
        traffic: 5,
        difficulty: 3,
      });
    }

    for (const row of rows) {
      const keyword = await prisma.keyword.create({
        data: { text: row.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          source: row.source,
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D0,
          traffic: row.traffic,
          difficulty: row.difficulty,
        },
      });
    }
    return created.id;
  };

  const seedPlay = async (): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.app',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Habit Tracker',
        summary: 'Build daily goals and log water every single day',
        description:
          'Build better habits with reminders and a sleep timer inside.',
        raw: {},
        capturedAt: D0,
      },
    });

    const rows = [
      { text: 'habit tracker', traffic: 8, difficulty: 3 },
      { text: 'daily goals', traffic: 7, difficulty: 2 },
      { text: 'sleep timer', traffic: 6, difficulty: 4 },
    ];
    for (const row of rows) {
      const keyword = await prisma.keyword.create({
        data: { text: row.text, store: Store.GOOGLE_PLAY, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D0,
          traffic: row.traffic,
          difficulty: row.difficulty,
        },
      });
    }
    return created.id;
  };

  it('reports field limits, coverage and a rule-respecting suggestion', async () => {
    const id = await seed(false);

    const response = await api.get(`/apps/${id}/metadata/audit`).expect(200);
    const result = response.body as MetadataAuditResult;

    const title = result.fields.find((field) => field.field === 'title');
    expect(title?.chars).toBe('Habit Tracker'.length);
    expect(title?.limit).toBe(30);
    expect(result.fields.map((field) => field.field)).not.toContain(
      'keywordField',
    );

    const covered = result.coverage.find((row) => row.text === 'habit tracker');
    expect(
      covered?.fields.find((field) => field.field === 'title')?.covered,
    ).toBe(true);
    expect(covered?.fields.map((field) => field.field)).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    expect(covered?.uncovered).toBe(false);
    const uncovered = result.coverage.find((row) => row.text === 'sleep timer');
    expect(uncovered?.uncovered).toBe(true);

    const suggestion = result.keywordFieldSuggestion;
    expect(suggestion).not.toBeNull();
    expect(suggestion?.charactersUsed).toBeLessThanOrEqual(100);
    expect(suggestion?.value).not.toContain(', ');
    expect(suggestion?.addedTerms).toContain('daily goal');
  });

  it('includes the keyword field when it has been pasted', async () => {
    const id = await seed(true);

    const response = await api.get(`/apps/${id}/metadata/audit`).expect(200);
    const result = response.body as MetadataAuditResult;

    const keywordField = result.fields.find(
      (field) => field.field === 'keywordField',
    );
    expect(keywordField).toBeDefined();
    expect(keywordField?.limit).toBe(100);
    expect(keywordField?.chars).toBe('water reminder'.length);
  });

  it('audits a google play app across title, short description and description', async () => {
    const id = await seedPlay();

    const response = await api.get(`/apps/${id}/metadata/audit`).expect(200);
    const result = response.body as MetadataAuditResult;

    expect(result.store).toBe(Store.GOOGLE_PLAY);
    expect(result.fields.map((field) => field.field)).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);

    const shortDescription = result.fields.find(
      (field) => field.field === 'shortDescription',
    );
    expect(shortDescription?.limit).toBe(80);
    expect(shortDescription?.indexed).toBe(true);

    const description = result.fields.find(
      (field) => field.field === 'description',
    );
    expect(description?.limit).toBe(4000);
    expect(description?.indexed).toBe(true);

    const coverageFields = result.coverage[0]?.fields.map(
      (field) => field.field,
    );
    expect(coverageFields).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);

    const inDescription = result.coverage.find(
      (row) => row.text === 'sleep timer',
    );
    expect(
      inDescription?.fields.find((field) => field.field === 'description')
        ?.covered,
    ).toBe(true);
    expect(inDescription?.uncovered).toBe(false);

    expect(result.keywordFieldSuggestion).toBeNull();
  });

  it('reports the metadata assistant configured', async () => {
    const response = await api.get('/metadata/assistant').expect(200);
    expect(response.body as MetadataAssistantStatus).toEqual({
      configured: true,
      model: 'gpt-4o',
    });
  });

  it('generates linted drafts for the store indexed fields', async () => {
    const id = await seed(false);

    const response = await api
      .post(`/apps/${id}/metadata/assistant`)
      .send({ instructions: 'be punchy' })
      .expect(201);
    const result = response.body as MetadataAssistantResult;

    expect(result.model).toBe('gpt-4o');
    expect(result.drafts.map((draft) => draft.field)).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    const title = result.drafts.find((draft) => draft.field === 'title');
    expect(title?.chars).toBeLessThanOrEqual(30);
    expect(title?.limit).toBe(30);
    expect(Array.isArray(title?.issues)).toBe(true);
  });

  it('returns 404 when generating drafts for an unknown app', async () => {
    await api.post('/apps/missing/metadata/assistant').send({}).expect(404);
  });

  it('rejects drafting a field the store does not support', async () => {
    const id = await seed(false);
    await api
      .post(`/apps/${id}/metadata/assistant`)
      .send({ fields: ['promotionalText'] })
      .expect(400);
  });
});
