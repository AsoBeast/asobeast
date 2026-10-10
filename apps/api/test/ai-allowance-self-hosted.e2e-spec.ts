import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aiCompletion } from '../src/ai/ai-completion.fixture';
import { aiPeriodOf } from '../src/ai/ai-period';
import {
  AiClient,
  AiCompletion,
  AiStructuredRequest,
  OPENAI_CLIENT,
} from '../src/ai/openai.client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 120 };

const structured = jest.fn<Promise<AiCompletion>, [AiStructuredRequest]>();
const fakeAiClient: AiClient = { model: 'gpt-test', structured };

describe('Monthly AI allowance on a self hosted instance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let actionId: string;

  const spent = (count: number) =>
    prisma.aiCall.createMany({
      data: Array.from({ length: count }, () => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        feature: 'actionExplanation',
        model: 'gpt-test',
        status: 'counted',
      })),
    });

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
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    structured.mockReset();
    structured.mockResolvedValue(
      aiCompletion({ explanation: 'Your title is missing it.' }, USAGE),
    );
    await prisma.aiCall.deleteMany();
    await seedUncoveredKeyword(prisma);
    await generateActionsAt(app, ACTION_DAY(0));
    ({ id: actionId } = await prisma.actionItem.findFirstOrThrow({
      select: { id: true },
    }));
  });

  afterAll(async () => {
    await prisma.aiCall.deleteMany();
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('records every call without a limit when billing is off', async () => {
    await spent(5_000);

    await api.post(`/actions/${actionId}/explain`).expect(200);

    await expect(prisma.aiCall.count()).resolves.toBe(5_001);
    await expect(
      prisma.aiCall.count({ where: { status: 'counted', ...USAGE } }),
    ).resolves.toBe(1);
    expect(structured).toHaveBeenCalledTimes(1);
  });

  it("reports an unlimited allowance with the month's usage", async () => {
    await spent(7);

    const plan = await api.get('/auth/plan').expect(200);

    expect(plan.body).toMatchObject({
      limits: { aiCallsPerMonth: null },
      usage: {
        aiCalls: {
          used: 7,
          limit: null,
          resetsAt: aiPeriodOf(new Date()).resetsAt.toISOString(),
        },
      },
    });
  });
});
