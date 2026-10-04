import './helpers/turn-ai-off';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiErrorEnvelope } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aiCompletion } from '../src/ai/ai-completion.fixture';
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
import { obliterateQueues } from './obliterate-queues';

const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 120 };

const structured = jest.fn<Promise<AiCompletion>, [AiStructuredRequest]>();
const fakeAiClient: AiClient = { model: 'gpt-test', structured };

describe('Monthly AI allowance on a self hosted instance that turned AI off (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let actionId: string;

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

  it('says AI is off rather than that an allowance renews', async () => {
    await prisma.aiCall.createMany({
      data: Array.from({ length: 4 }, () => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        feature: 'actionExplanation',
        model: 'gpt-test',
        status: 'counted',
      })),
    });

    const refused = await api.post(`/actions/${actionId}/explain`).expect(429);

    const body = refused.body as ApiErrorEnvelope;
    expect(body.message).toBe('This workspace includes no AI calls.');
    expect(body.aiAllowance).toMatchObject({
      limit: 0,
      used: 4,
      upgradeTo: null,
    });
    expect(refused.headers['retry-after']).toBe(String(body.retryAfterSeconds));
    expect(structured).not.toHaveBeenCalled();
  });
});
