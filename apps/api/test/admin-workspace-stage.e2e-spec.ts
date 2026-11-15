import './helpers/enable-billing';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type {
  AdminConversion,
  AdminOverview,
  AdminUserList,
  SupportWorkspaceSummary,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { ownerAgent, useCookies } from './helpers/session';
import { seedApiToken, truncateUsers } from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_TRIAL_WORKSPACE = 'ws_card_trial';
const CARD_TRIAL_OWNER = 'owner@card-trial.example.com';

describe('Admin area workspace stages (billing mode)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let operator: Awaited<ReturnType<typeof ownerAgent>>;

  const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

  const COMPED_OPERATOR = {
    plan: 'indie',
    planExpiresAt: daysFromNow(30),
    trialStartedAt: null,
    trialEndsAt: null,
    subscriptionId: null,
    subscriptionStatus: null,
    firstPaidAt: null,
    cancelAtPeriodEnd: false,
    deletionRequestedAt: null,
    deletionRequestedBy: null,
    deletionDueAt: null,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    configureAdminSurfaces(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: COMPED_OPERATOR,
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default', ...COMPED_OPERATOR },
    });
    await truncateUsers(prisma);
    operator = await ownerAgent(app);
    await prisma.workspace.create({
      data: {
        id: CARD_TRIAL_WORKSPACE,
        name: 'Card Trial Studio',
        plan: 'indie',
        subscriptionId: 'sub_card_trial',
        subscriptionStatus: 'trialing',
        planExpiresAt: daysFromNow(5),
        trialStartedAt: daysFromNow(-2),
        trialEndsAt: daysFromNow(5),
        billingInterval: 'month',
      },
    });
    await seedApiToken(prisma, {
      seed: 'cardtrialowner',
      email: CARD_TRIAL_OWNER,
      workspaceId: CARD_TRIAL_WORKSPACE,
      role: 'owner',
    });
  });

  afterAll(async () => {
    await prisma.supportAccess.deleteMany({});
    await prisma.workspace.deleteMany({ where: { id: CARD_TRIAL_WORKSPACE } });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'free', planExpiresAt: null },
    });
    await truncateUsers(prisma);
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('counts a workspace on a card trial as a trial, not under its plan', async () => {
    const overview = (await operator.get('/admin/support/overview').expect(200))
      .body as AdminOverview;
    const staged = (stage: string) =>
      overview.workspaces.byStage?.find((row) => row.key === stage)?.count;

    expect(staged('trialing')).toBe(1);
    expect(staged('paying')).toBe(0);
    expect(staged('comped')).toBe(1);

    const users = (await operator.get('/admin/support/users').expect(200))
      .body as AdminUserList;
    expect(
      users.items.find((user) => user.email === CARD_TRIAL_OWNER),
    ).toMatchObject({ workspacePlan: 'indie', workspaceStage: 'trialing' });

    const workspaces = (
      await operator.get('/admin/support/workspaces').expect(200)
    ).body as SupportWorkspaceSummary[];
    expect(
      workspaces.find(
        (workspace) => workspace.workspaceId === CARD_TRIAL_WORKSPACE,
      ),
    ).toMatchObject({
      plan: 'indie',
      stage: 'trialing',
      cancelAtPeriodEnd: false,
      billingInterval: 'month',
      firstPaidAt: null,
    });
  });

  it('counts the card trial in the conversion funnel and among trials ending soon', async () => {
    const conversion = (
      await operator.get('/admin/support/conversion').expect(200)
    ).body as AdminConversion;
    const step = (key: string) =>
      conversion.funnel.find((row) => row.key === key)?.count;

    expect(conversion.billing).toBe(true);
    expect(step('trial-started')).toBe(1);
    expect(step('paid')).toBe(0);
    expect(conversion.trials).toEqual({ inProgress: 1, endingSoon: 0 });
    expect(conversion.trialToPaid?.current).toEqual({ ended: 0, paid: 0 });
    expect(conversion.medianDays.signupToTrial).not.toBeUndefined();
    expect(conversion.cohorts.at(-1)).toHaveProperty('stillPaying');
  });

  it('names who scheduled a deletion and when it erases', async () => {
    const dueAt = daysFromNow(7);
    await prisma.workspace.update({
      where: { id: CARD_TRIAL_WORKSPACE },
      data: {
        deletionRequestedAt: new Date(),
        deletionRequestedBy: CARD_TRIAL_OWNER,
        deletionDueAt: dueAt,
      },
    });

    const workspaces = (
      await operator.get('/admin/support/workspaces').expect(200)
    ).body as SupportWorkspaceSummary[];

    expect(
      workspaces.find(
        (workspace) => workspace.workspaceId === CARD_TRIAL_WORKSPACE,
      ),
    ).toMatchObject({
      deletionRequestedBy: CARD_TRIAL_OWNER,
      deletionDueAt: dueAt.toISOString(),
    });
    expect(
      workspaces.find(
        (workspace) => workspace.workspaceId === DEFAULT_WORKSPACE_ID,
      ),
    ).toMatchObject({
      deletionRequestedAt: null,
      deletionRequestedBy: null,
      deletionDueAt: null,
    });
  });

  it('keeps answering the plan each workspace is entitled to', async () => {
    const overview = (await operator.get('/admin/support/overview').expect(200))
      .body as AdminOverview;

    expect(
      overview.workspaces.byPlan.find((row) => row.key === 'indie')?.count,
    ).toBe(2);
    expect(
      overview.workspaces.byPlan.find((row) => row.key === 'trial')?.count,
    ).toBe(0);
  });
});
