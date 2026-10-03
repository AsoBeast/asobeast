import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { APIConnectionError } from 'openai';
import type { AccountPlan, ApiErrorEnvelope } from '@asobeast/shared';
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
import { AuditAiRunsService } from '../src/audit/audit-ai-runs.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { AuditCreativePayload, QUEUES } from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';
import { restoreAuthEnv } from './helpers/auth-env';
import { OWNER, ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 120 };
const OTHER_WORKSPACE = 'ws_ai_other';

const OBSERVATIONS = {
  icon: {
    hasText: false,
    elementCount: 'one',
    contrast: 'high',
    similarCompetitorPosition: null,
  },
  screenshots: [
    {
      position: 1,
      captionText: 'Plan every budget',
      captionReadable: true,
      captionLanguage: 'en',
      message: 'benefit',
    },
  ],
  consistentStyle: true,
};

const DRAFTS = {
  drafts: [
    {
      field: 'title',
      value: 'Budget Planner: Expense Tracker',
      rationale: 'Adds the primary keyword.',
    },
    {
      field: 'subtitle',
      value: 'Money & Spending Log',
      rationale: 'Secondary keywords with no title repeats.',
    },
    {
      field: 'keywordField',
      value: 'bills,savings,wallet,finance',
      rationale: 'Covers uncovered terms in singular form.',
    },
  ],
};

const structured = jest.fn<Promise<AiCompletion>, [AiStructuredRequest]>();
const fakeAiClient: AiClient = { model: 'gpt-test', structured };

describe('Monthly AI allowance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let actionId: string;
  let appId: string;

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
    ({ appId } = await seedUncoveredKeyword(prisma));
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

  it("reports the month's ai usage and allowance on the plan", async () => {
    await spent(3);

    const plan = await api.get('/auth/plan').expect(200);

    expect(plan.body).toMatchObject({
      limits: { aiCallsPerMonth: 200 },
      usage: {
        aiCalls: {
          used: 3,
          limit: 200,
          resetsAt: aiPeriodOf(new Date()).resetsAt.toISOString(),
        },
      },
    });
  });

  it('reports the same usage the limiter refused at', async () => {
    await spent(200);

    const refused = await explain(actionId).expect(429);
    const plan = await api.get('/auth/plan').expect(200);

    expect((plan.body as AccountPlan).usage.aiCalls?.used).toBe(
      (refused.body as ApiErrorEnvelope).aiAllowance?.used,
    );
  });

  describe('metadata drafts', () => {
    const draft = (body: Record<string, unknown> = {}) =>
      api.post(`/apps/${appId}/metadata/assistant`).send(body);

    beforeEach(() => {
      structured.mockResolvedValue(aiCompletion(DRAFTS, USAGE));
    });

    it('records one counted call for a set of drafts', async () => {
      await draft().expect(201);

      const owner = await prisma.user.findUniqueOrThrow({
        where: { email: OWNER.email },
      });
      const rows = await prisma.aiCall.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        feature: 'metadataDrafts',
        status: 'counted',
        appId,
        userId: owner.id,
        ...USAGE,
      });
    });

    it('writes nothing for a field the store cannot draft', async () => {
      await draft({ fields: ['shortDescription'] }).expect(400);

      await expect(prisma.aiCall.count()).resolves.toBe(0);
    });

    it('refuses drafts past the limit without calling the model', async () => {
      await spent(200);

      await draft().expect(429);

      expect(structured).not.toHaveBeenCalled();
    });

    it('keeps the call when the drafts come back incomplete', async () => {
      structured.mockResolvedValue(
        aiCompletion({ drafts: [DRAFTS.drafts[0]] }, USAGE),
      );

      await draft().expect(502);

      const rows = await prisma.aiCall.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('counted');
    });
  });

  describe('creative analysis', () => {
    const queuedJobs = async () =>
      (
        await app
          .get<Queue<AuditCreativePayload>>(getQueueToken(QUEUES.AI), {
            strict: false,
          })
          .getJobs()
      ).map((job) => job.data);

    const requestRun = () => api.post(`/apps/${appId}/audit/ai/runs`);

    const executeQueued = async () => {
      const [job] = await queuedJobs();
      const requestedAt = new Date(job.requestedAt);
      return asWorkspace(app, async () => {
        const runs = app.get(AuditAiRunsService);
        await runs.start(appId, requestedAt);
        await runs.execute(appId, requestedAt, job.aiCallId);
      });
    };

    beforeEach(async () => {
      structured.mockResolvedValue(aiCompletion(OBSERVATIONS, USAGE));
      await obliterateQueues(app);
      await pauseQueues(app);
      await prisma.appSnapshot.create({
        data: {
          appId,
          title: 'Budget Planner',
          description: 'Track spending.',
          raw: {
            icon: 'https://cdn.example.com/icon.png',
            screenshots: ['s0.png', 's1.png'],
          },
          capturedAt: new Date(),
        },
      });
    });

    it('reserves a call when a run is requested and counts it when the run finishes', async () => {
      await requestRun().expect(202);

      const [reserved] = await prisma.aiCall.findMany();
      expect(reserved).toMatchObject({
        feature: 'creativeAnalysis',
        status: 'reserved',
        appId,
      });
      const [job] = await queuedJobs();
      expect(job.aiCallId).toBe(reserved.id);

      await executeQueued();

      const rows = await prisma.aiCall.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: reserved.id,
        status: 'counted',
        ...USAGE,
      });
    });

    it('reserves nothing for an unchanged listing', async () => {
      await requestRun().expect(202);
      await executeQueued();

      const again = await requestRun().expect(202);

      expect(again.body).toMatchObject({ reused: true });
      await expect(prisma.aiCall.count()).resolves.toBe(1);
    });

    it('reserves nothing while a run is already queued', async () => {
      await requestRun().expect(202);
      await requestRun().expect(202);

      await expect(prisma.aiCall.count()).resolves.toBe(1);
      await expect(queuedJobs()).resolves.toHaveLength(1);
    });

    it('queues nothing past the limit', async () => {
      await spent(200);

      await requestRun().expect(429);

      await expect(queuedJobs()).resolves.toHaveLength(0);
      await expect(
        prisma.auditInsight.count({ where: { runState: 'queued' } }),
      ).resolves.toBe(0);
    });

    it('counts the deprecated synchronous audit once', async () => {
      await api.post(`/apps/${appId}/audit/ai`).expect(201);

      const rows = await prisma.aiCall.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        feature: 'creativeAnalysis',
        status: 'counted',
      });
    });

    it('gives the call back when a run fails without an answer', async () => {
      await requestRun().expect(202);
      structured.mockRejectedValue(
        classifyRequestError(
          new APIConnectionError({ message: 'down' }),
          'gpt-test',
        ),
      );
      const [job] = await queuedJobs();
      const requestedAt = new Date(job.requestedAt);

      await expect(executeQueued()).rejects.toThrow('Could not reach OpenAI.');
      await asWorkspace(app, () =>
        app.get(AuditAiRunsService).fail(appId, requestedAt, 'x', job.aiCallId),
      );

      const rows = await prisma.aiCall.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('released');
      await expect(
        prisma.auditInsight.findUniqueOrThrow({ where: { appId } }),
      ).resolves.toMatchObject({ runState: 'failed' });
    });
  });
});
