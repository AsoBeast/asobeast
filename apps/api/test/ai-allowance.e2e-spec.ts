import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { APIConnectionError } from 'openai';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aiCompletion } from '../src/ai/ai-completion.fixture';
import { aiPeriodOf, secondsUntil } from '../src/ai/ai-period';
import {
  AiClient,
  AiCompletion,
  AiStructuredRequest,
  OPENAI_CLIENT,
  UnusableAnswerError,
  classifyRequestError,
} from '../src/ai/openai.client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { restoreAuthEnv } from './helpers/auth-env';
import { OWNER, ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
} from './obliterate-queues';

const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 120 };
const OTHER_WORKSPACE = 'ws_ai_other';

const structured = jest.fn<Promise<AiCompletion>, [AiStructuredRequest]>();
const fakeAiClient: AiClient = { model: 'gpt-test', structured };

describe('Monthly AI allowance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let actionId: string;

  const setPlan = (plan: string, trialEndsAt: Date | null = null) =>
    prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan, trialEndsAt, planExpiresAt: null },
    });

  const spent = (
    count: number,
    status = 'counted',
    createdAt = new Date(),
    workspaceId = DEFAULT_WORKSPACE_ID,
  ) =>
    prisma.aiCall.createMany({
      data: Array.from({ length: count }, () => ({
        workspaceId,
        feature: 'actionExplanation',
        model: 'gpt-test',
        status,
        createdAt,
      })),
    });

  const spending = () =>
    prisma.aiCall.count({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        status: { in: ['reserved', 'counted'] },
      },
    });

  const moreActions = async (count: number) => {
    const first = await prisma.actionItem.findFirstOrThrow({
      where: { id: actionId },
      omit: { id: true },
    });
    await prisma.actionItem.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        ...first,
        evidence: first.evidence ?? Prisma.JsonNull,
        fingerprint: `${first.fingerprint}~${index}`,
      })),
    });
    const rows = await prisma.actionItem.findMany({
      where: { id: { not: actionId } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  };

  const explain = (id: string) => api.post(`/actions/${id}/explain`);

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
    await prisma.user.deleteMany({ where: { email: { not: OWNER.email } } });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    structured.mockReset();
    structured.mockResolvedValue(
      aiCompletion({ explanation: 'Your title is missing it.' }, USAGE),
    );
    await clearRateLimitCounters(app);
    await clearOnDemandCounters(app);
    await prisma.aiCall.deleteMany();
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await setPlan('indie');
    await seedUncoveredKeyword(prisma);
    await generateActionsAt(app, ACTION_DAY(0));
    ({ id: actionId } = await prisma.actionItem.findFirstOrThrow({
      select: { id: true },
    }));
  });

  afterAll(async () => {
    await prisma.aiCall.deleteMany();
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await setPlan('free');
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  it('records one counted call with model, tokens, user and app', async () => {
    await explain(actionId).expect(200);

    const action = await prisma.actionItem.findUniqueOrThrow({
      where: { id: actionId },
    });
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: OWNER.email },
    });
    const rows = await prisma.aiCall.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'counted',
      feature: 'actionExplanation',
      model: 'gpt-test',
      appId: action.appId,
      userId: owner.id,
      ...USAGE,
    });
    expect(rows[0].settledAt).toBeInstanceOf(Date);
  });

  it('refuses the call past the limit with 429, Retry-After and the allowance, without calling the model', async () => {
    await spent(200);

    const response = await explain(actionId).expect(429);

    const now = new Date();
    const { resetsAt } = aiPeriodOf(now);
    const body = response.body as {
      aiAllowance: unknown;
      retryAfterSeconds: number;
    };
    expect(body.aiAllowance).toEqual({
      plan: 'indie',
      limit: 200,
      used: 200,
      resetsAt: resetsAt.toISOString(),
      upgradeTo: 'ultimate',
    });
    expect(String(body.retryAfterSeconds)).toBe(
      response.headers['retry-after'],
    );
    expect(
      Math.abs(body.retryAfterSeconds - secondsUntil(resetsAt, now)),
    ).toBeLessThanOrEqual(5);
    expect(structured).not.toHaveBeenCalled();
    await expect(spending()).resolves.toBe(200);
  });

  it('counts nothing from the previous month', async () => {
    await spent(
      200,
      'counted',
      new Date(aiPeriodOf(new Date()).start.getTime() - 1),
    );

    await explain(actionId).expect(200);
  });

  it('counts reserved calls and not released ones', async () => {
    await spent(150, 'released');
    await spent(199, 'reserved');
    const [second] = await moreActions(1);

    await explain(actionId).expect(200);
    const refused = await explain(second).expect(429);

    expect(refused.body).toMatchObject({ aiAllowance: { used: 200 } });
  });

  it('grants the last call to exactly one of five concurrent requests', async () => {
    await spent(199);
    const others = await moreActions(4);

    const responses = await Promise.all(
      [actionId, ...others].map((id) => explain(id)),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 429, 429, 429, 429,
    ]);
    expect(structured).toHaveBeenCalledTimes(1);
    await expect(spending()).resolves.toBe(200);
  });

  it('gives the call back when openai never answered', async () => {
    structured.mockRejectedValueOnce(
      classifyRequestError(
        new APIConnectionError({ message: 'down' }),
        'gpt-test',
      ),
    );

    await explain(actionId).expect(502);

    const rows = await prisma.aiCall.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('released');
    await expect(spending()).resolves.toBe(0);
  });

  it('keeps the call when the answer was unusable', async () => {
    structured.mockRejectedValueOnce(
      new UnusableAnswerError(
        'OpenAI refused to analyze this listing.',
        false,
        USAGE,
      ),
    );

    await explain(actionId).expect(502);

    const rows = await prisma.aiCall.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'counted', ...USAGE });
  });

  it('ignores what another workspace spent', async () => {
    await prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      create: { id: OTHER_WORKSPACE, name: 'Other', plan: 'indie' },
      update: {},
    });
    await spent(200, 'counted', new Date(), OTHER_WORKSPACE);

    await explain(actionId).expect(200);
  });

  it('writes nothing for a request refused before the call', async () => {
    await explain('act_missing').expect(404);

    await expect(prisma.aiCall.count()).resolves.toBe(0);
  });

  it('raises the limit at once on an upgrade and keeps the usage', async () => {
    await spent(200);
    await setPlan('ultimate');

    await explain(actionId).expect(200);

    await expect(spending()).resolves.toBe(201);
  });

  it('refuses until the renewal after a downgrade below the usage', async () => {
    await setPlan('ultimate');
    await spent(500);
    await setPlan('indie');

    const response = await explain(actionId).expect(429);

    expect(response.body).toMatchObject({
      aiAllowance: { used: 500, limit: 200 },
    });
  });

  it('spends one call on a double click', async () => {
    structured.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(aiCompletion({ explanation: 'x' }, USAGE)),
            100,
          ),
        ),
    );

    const responses = await Promise.all([explain(actionId), explain(actionId)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(structured).toHaveBeenCalledTimes(1);
    await expect(prisma.aiCall.count()).resolves.toBe(1);
  });

  it('gives a trial 25 calls', async () => {
    await setPlan('free', new Date(Date.now() + 3 * 86_400_000));
    await spent(25);

    const response = await explain(actionId).expect(429);

    expect(response.body).toMatchObject({
      aiAllowance: { plan: 'trial', limit: 25, upgradeTo: 'indie' },
    });
  });
});
