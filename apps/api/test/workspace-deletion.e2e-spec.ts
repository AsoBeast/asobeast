import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AccountDeletionService } from '../src/account/account-deletion.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TENANT_TABLES } from '../src/common/tenancy/tenant-tables';
import { obliterateQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';

const WORKSPACE = 'ws_deletion_target';
const NEIGHBOUR = 'ws_deletion_neighbour';
const RACED = 'ws_deletion_raced';
const KEYWORD_TEXT = 'deletion habit tracker';
const DAY = new Date('2026-08-14T00:00:00.000Z');

interface Seeded {
  appId: string;
  competitorId: string;
  groupId: string;
  userId: string;
  tokenId: string;
  inviteId: string;
  snapshotId: string;
  keywordId: string;
  webhookId: string;
  emailAlertId: string;
  deliveryId: string;
  alertEventId: string;
  actionId: string;
  reviewId: string;
  changeId: string;
}

describe('Workspace deletion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let deletion: AccountDeletionService;
  let seeded: Seeded;

  async function seed(workspaceId: string): Promise<Seeded> {
    await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: workspaceId },
    });
    const user = await prisma.user.create({
      data: {
        workspaceId,
        email: `${workspaceId}@deletion.example.com`,
        passwordHash: 'login-unused',
        role: 'owner',
      },
    });
    const token = await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: 'deletion',
        tokenHash: `hash-${workspaceId}`,
        prefix: 'asob_delete',
      },
    });
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email: `invited-${workspaceId}@deletion.example.com`,
        role: 'member',
        tokenHash: `invite-${workspaceId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const group = await prisma.appGroup.create({
      data: { workspaceId, name: `group-${workspaceId}` },
    });
    const owned = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `owned-${workspaceId}`,
        name: 'Owned',
        groupId: group.id,
      },
    });
    const competitor = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `rival-${workspaceId}`,
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: owned.id,
      },
    });
    const snapshot = await prisma.appSnapshot.create({
      data: {
        appId: owned.id,
        title: 'Owned',
        description: 'stored listing',
        raw: {},
      },
    });
    const keyword = await prisma.keyword.upsert({
      where: {
        text_store_country: {
          text: KEYWORD_TEXT,
          store: Store.APP_STORE,
          country: 'us',
        },
      },
      update: {},
      create: { text: KEYWORD_TEXT, store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: { appId: owned.id, keywordId: keyword.id, source: 'MANUAL' },
    });
    await prisma.keywordRanking.create({
      data: {
        appId: owned.id,
        workspaceId,
        keywordId: keyword.id,
        date: DAY,
        position: 4,
      },
    });
    await prisma.categoryRank.create({
      data: {
        appId: owned.id,
        date: DAY,
        collection: 'TOP_FREE',
        genre: '6007',
        position: 12,
      },
    });
    const review = await prisma.review.create({
      data: {
        appId: owned.id,
        reviewId: `r-${workspaceId}`,
        score: 2,
        text: 'crashes on launch',
      },
    });
    const change = await prisma.changeEvent.create({
      data: { appId: owned.id, field: 'title', before: 'a', after: 'b' },
    });
    await prisma.auditInsight.create({
      data: { appId: owned.id, model: 'gpt-4o', checks: {} },
    });
    await prisma.auditScore.create({
      data: {
        appId: owned.id,
        date: DAY,
        coveredWeight: 40,
        totalWeight: 100,
        factors: {},
      },
    });
    await prisma.suggestProbe.create({
      data: {
        appId: owned.id,
        term: 'habit',
        country: 'us',
        day: DAY,
        probe: 'a',
        results: [],
      },
    });
    const action = await prisma.actionItem.create({
      data: {
        workspaceId,
        appId: owned.id,
        rule: 'keyword.defend',
        category: 'keywords',
        store: Store.APP_STORE,
        country: 'us',
        fingerprint: `fp-${workspaceId}`,
        priority: 'high',
        impact: 50,
        formulaVersion: '1',
        evidence: {},
        lastSeenAt: new Date(),
      },
    });
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId,
        url: `https://hooks.example.com/${workspaceId}`,
        events: ['rank.dropped'],
      },
    });
    const emailAlert = await prisma.emailAlert.create({
      data: {
        workspaceId,
        email: `alerts-${workspaceId}@deletion.example.com`,
        events: ['rank.dropped'],
      },
    });
    const delivery = await prisma.alertDelivery.create({
      data: {
        channel: 'webhook',
        webhookId: webhook.id,
        event: 'rank.dropped',
        status: 'delivered',
        attempt: 1,
      },
    });
    const alertEvent = await prisma.alertEvent.create({
      data: {
        workspaceId,
        event: 'rank.dropped',
        dedupeKey: `dedupe-${workspaceId}`,
        payload: {},
      },
    });
    await prisma.billingEvent.create({
      data: {
        id: `evt-${workspaceId}`,
        type: 'customer.subscription.updated',
        workspaceId,
        createdAt: new Date(),
        payload: {},
        processedAt: new Date(),
      },
    });
    await prisma.supportAccess.create({
      data: {
        actorUserId: 'operator',
        actorEmail: 'operator@example.com',
        workspaceId,
        action: 'view',
      },
    });

    return {
      appId: owned.id,
      competitorId: competitor.id,
      groupId: group.id,
      userId: user.id,
      tokenId: token.id,
      inviteId: invite.id,
      snapshotId: snapshot.id,
      keywordId: keyword.id,
      webhookId: webhook.id,
      emailAlertId: emailAlert.id,
      deliveryId: delivery.id,
      alertEventId: alertEvent.id,
      actionId: action.id,
      reviewId: review.id,
      changeId: change.id,
    };
  }

  async function remaining(target: Seeded): Promise<Record<string, number>> {
    const [
      workspace,
      user,
      apiToken,
      workspaceInvite,
      appGroup,
      apps,
      appSnapshot,
      trackedKeyword,
      keywordRanking,
      categoryRank,
      review,
      changeEvent,
      auditInsight,
      auditScore,
      suggestProbe,
      actionItem,
      webhook,
      emailAlert,
      alertDelivery,
      alertEvent,
    ] = await Promise.all([
      prisma.workspace.count({ where: { id: WORKSPACE } }),
      prisma.user.count({ where: { id: target.userId } }),
      prisma.apiToken.count({ where: { id: target.tokenId } }),
      prisma.workspaceInvite.count({ where: { id: target.inviteId } }),
      prisma.appGroup.count({ where: { id: target.groupId } }),
      prisma.app.count({
        where: { id: { in: [target.appId, target.competitorId] } },
      }),
      prisma.appSnapshot.count({ where: { id: target.snapshotId } }),
      prisma.trackedKeyword.count({ where: { appId: target.appId } }),
      prisma.keywordRanking.count({ where: { workspaceId: WORKSPACE } }),
      prisma.categoryRank.count({ where: { appId: target.appId } }),
      prisma.review.count({ where: { id: target.reviewId } }),
      prisma.changeEvent.count({ where: { id: target.changeId } }),
      prisma.auditInsight.count({ where: { appId: target.appId } }),
      prisma.auditScore.count({ where: { appId: target.appId } }),
      prisma.suggestProbe.count({ where: { appId: target.appId } }),
      prisma.actionItem.count({ where: { id: target.actionId } }),
      prisma.webhook.count({ where: { id: target.webhookId } }),
      prisma.emailAlert.count({ where: { id: target.emailAlertId } }),
      prisma.alertDelivery.count({ where: { id: target.deliveryId } }),
      prisma.alertEvent.count({ where: { id: target.alertEventId } }),
    ]);

    return {
      Workspace: workspace,
      User: user,
      ApiToken: apiToken,
      WorkspaceInvite: workspaceInvite,
      AppGroup: appGroup,
      App: apps,
      AppSnapshot: appSnapshot,
      TrackedKeyword: trackedKeyword,
      KeywordRanking: keywordRanking,
      CategoryRank: categoryRank,
      Review: review,
      ChangeEvent: changeEvent,
      AuditInsight: auditInsight,
      AuditScore: auditScore,
      SuggestProbe: suggestProbe,
      ActionItem: actionItem,
      Webhook: webhook,
      EmailAlert: emailAlert,
      AlertDelivery: alertDelivery,
      AlertEvent: alertEvent,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    deletion = app.get(AccountDeletionService);
    prisma = testDb();

    for (const workspaceId of [WORKSPACE, NEIGHBOUR]) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      await prisma.billingEvent.deleteMany({
        where: { id: `evt-${workspaceId}` },
      });
      await prisma.supportAccess.deleteMany({ where: { workspaceId } });
    }
    seeded = await seed(WORKSPACE);
    await seed(NEIGHBOUR);
  });

  afterAll(async () => {
    for (const workspaceId of [WORKSPACE, NEIGHBOUR]) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      await prisma.billingEvent.deleteMany({
        where: { id: `evt-${workspaceId}` },
      });
      await prisma.supportAccess.deleteMany({ where: { workspaceId } });
    }
    await prisma.keyword.deleteMany({ where: { text: KEYWORD_TEXT } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('seeds a row in every tenant owned table before deleting', async () => {
    const counts = await remaining(seeded);

    expect(Object.values(counts).every((count) => count > 0)).toBe(true);
    expect(Object.keys(counts).sort()).toEqual([...TENANT_TABLES].sort());
  });

  it('erases nothing before the grace period ends', async () => {
    await prisma.workspace.update({
      where: { id: WORKSPACE },
      data: { deletionDueAt: new Date(Date.now() + 86_400_000) },
    });

    await expect(deletion.eraseDue()).resolves.toEqual([]);
    await expect(
      prisma.workspace.count({ where: { id: WORKSPACE } }),
    ).resolves.toBe(1);
  });

  it('removes every tenant owned row once the grace period has passed', async () => {
    await prisma.workspace.update({
      where: { id: WORKSPACE },
      data: { deletionDueAt: new Date(Date.now() - 1_000) },
    });

    await expect(deletion.eraseDue()).resolves.toEqual([WORKSPACE]);

    const counts = await remaining(seeded);
    expect(counts).toEqual(
      Object.fromEntries(Object.keys(counts).map((table) => [table, 0])),
    );
  });

  it('leaves the neighbouring workspace untouched', async () => {
    await expect(
      prisma.workspace.count({ where: { id: NEIGHBOUR } }),
    ).resolves.toBe(1);
    await expect(
      prisma.app.count({ where: { workspaceId: NEIGHBOUR } }),
    ).resolves.toBe(2);
  });

  it('keeps the shared keyword row that other workspaces still track', async () => {
    await expect(
      prisma.keyword.count({ where: { text: KEYWORD_TEXT } }),
    ).resolves.toBe(1);
  });

  it('detaches the billing event rather than deleting the payment record', async () => {
    const event = await prisma.billingEvent.findUnique({
      where: { id: `evt-${WORKSPACE}` },
    });

    expect(event).not.toBeNull();
    expect(event?.workspaceId).toBeNull();
  });

  it('keeps the support audit trail, which outlives the workspace', async () => {
    await expect(
      prisma.supportAccess.count({ where: { workspaceId: WORKSPACE } }),
    ).resolves.toBe(1);
  });

  describe('when erasure races the customer', () => {
    beforeEach(async () => {
      await prisma.workspace.deleteMany({ where: { id: RACED } });
      await prisma.billingEvent.deleteMany({ where: { id: `evt-${RACED}` } });
      await prisma.workspace.create({
        data: {
          id: RACED,
          name: RACED,
          deletionRequestedAt: new Date(Date.now() - 2_000),
          deletionRequestedBy: 'racer@example.com',
          deletionDueAt: new Date(Date.now() - 1_000),
        },
      });
      await prisma.billingEvent.create({
        data: {
          id: `evt-${RACED}`,
          type: 'customer.subscription.updated',
          workspaceId: RACED,
          createdAt: new Date(),
          payload: {},
          processedAt: new Date(),
        },
      });
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      await prisma.workspace.deleteMany({ where: { id: RACED } });
      await prisma.billingEvent.deleteMany({ where: { id: `evt-${RACED}` } });
    });

    it('spares a workspace whose deletion was cancelled after the due list was read', async () => {
      const service = app.get(PrismaService);
      jest
        .spyOn(service.workspace, 'findMany')
        .mockResolvedValueOnce([{ id: RACED }] as never);
      await prisma.workspace.update({
        where: { id: RACED },
        data: {
          deletionRequestedAt: null,
          deletionRequestedBy: null,
          deletionDueAt: null,
        },
      });

      await expect(deletion.eraseDue()).resolves.toEqual([]);

      await expect(
        prisma.workspace.count({ where: { id: RACED } }),
      ).resolves.toBe(1);
      await expect(
        prisma.billingEvent.findUnique({ where: { id: `evt-${RACED}` } }),
      ).resolves.toMatchObject({ workspaceId: RACED });
    });

    it('leaves billing attached when the workspace delete fails', async () => {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION refuse_workspace_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'deletion drill'; END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER refuse_workspace_delete BEFORE DELETE ON "Workspace"
        FOR EACH ROW WHEN (OLD."id" = '${RACED}')
        EXECUTE FUNCTION refuse_workspace_delete();
      `);

      try {
        await expect(deletion.eraseDue()).rejects.toThrow();
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS refuse_workspace_delete ON "Workspace"',
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION IF EXISTS refuse_workspace_delete()',
        );
      }

      await expect(
        prisma.workspace.count({ where: { id: RACED } }),
      ).resolves.toBe(1);
      await expect(
        prisma.billingEvent.findUnique({ where: { id: `evt-${RACED}` } }),
      ).resolves.toMatchObject({ workspaceId: RACED });
    });
  });
});
