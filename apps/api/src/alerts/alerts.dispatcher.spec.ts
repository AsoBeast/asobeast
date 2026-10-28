import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  RANK_DEPTH,
  RankDroppedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
} from '@asobeast/shared';
import { negative, newReview } from './email-fixtures.fixture';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { Env } from '../config/env';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
} from '../jobs/jobs.types';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AlertAppIdentities } from './alert-app-identities';
import { AlertsDispatcher } from './alerts.dispatcher';
import { chartEntered } from './chart-events.fixture';
import { MailerService } from './mailer.service';

const rankPayload: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'game' },
  from: 3,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

const milestone: RankMilestonePayload = {
  event: 'rank.milestone',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'game', store: 'APP_STORE', country: 'us' },
  tier: 10,
  direction: 'entered',
  from: 14,
  to: 8,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
};

const overtake: RankOvertakenPayload = {
  event: 'rank.overtaken',
  occurredAt: milestone.occurredAt,
  app: milestone.app,
  keyword: milestone.keyword,
  competitor: { id: 'c1', name: 'Rival', from: 9, to: 4 },
  from: 5,
  to: 6,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
};

const buildConfig = (delivery: 'batched' | 'instant') =>
  ({
    get: jest.fn(() => delivery),
  }) as unknown as ConfigService<Env, true>;

interface UpdateArgs {
  where: { dedupeKey: string; flushedAt: null; flushId: null };
  data: {
    event: string;
    appId: string | null;
    payload: RankDroppedPayload;
  };
}

interface CreateArgs {
  data: UpdateArgs['data'] & {
    workspaceId: string;
    dedupeKey: string;
  };
}

const buildPrisma = () => {
  const updates: UpdateArgs[] = [];
  return {
    updates,
    alertEvent: {
      updateMany: jest.fn((args: UpdateArgs) => {
        updates.push(args);
        return Promise.resolve({ count: 0 });
      }),
      create: jest
        .fn<(args: CreateArgs) => Promise<object>>()
        .mockResolvedValue({}),
    },
    webhook: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    emailAlert: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    app: { findUnique: jest.fn().mockResolvedValue(null) },
  };
};

const buildQueue = () => {
  const add = jest.fn().mockResolvedValue({});
  const queue = { add } as unknown as Queue<
    DeliverAlertPayload | DeliverEmailPayload
  >;
  return { add, queue };
};

const workspace = new WorkspaceContext();

function inWorkspace(work: () => Promise<void>): Promise<void> {
  return workspace.run(DEFAULT_WORKSPACE_ID, async () => {
    await work();
  });
}

describe('AlertsDispatcher', () => {
  it('collects into the outbox in batched mode', async () => {
    const prisma = buildPrisma();
    const { add, queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.alertEvent.create).toHaveBeenCalledTimes(1);
    const args = prisma.updates[0];
    expect(args.where).toEqual({
      dedupeKey: 'rank:app1:kw1:2026-07-22',
      flushedAt: null,
      flushId: null,
    });
    expect(args.data).toEqual({
      event: 'rank.dropped',
      appId: 'app1',
      payload: rankPayload,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('updates the latest values only before a row is claimed', async () => {
    const prisma = buildPrisma();
    prisma.alertEvent.updateMany.mockResolvedValue({ count: 1 });
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
  });

  it('keeps a claimed or flushed dedupe row immutable', async () => {
    const prisma = buildPrisma();
    prisma.alertEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.8.0',
      }),
    );
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.updates[1].where).toMatchObject({
      flushedAt: null,
      flushId: null,
    });
  });

  it('resolves a create race through the known unique conflict', async () => {
    const prisma = buildPrisma();
    prisma.alertEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.alertEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.8.0',
      }),
    );
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.alertEvent.create).toHaveBeenCalledTimes(1);
  });

  it('bypasses the outbox for the weekly digest', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await dispatcher.dispatch({
      event: 'digest.weekly',
      occurredAt: '2026-07-22T10:00:00.000Z',
      window: { from: '2026-07-15', to: '2026-07-22' },
      apps: [],
      groups: [],
    } as never);

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
  });

  it('delivers per event in instant mode', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('instant'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
  });

  it('collects a milestone into the outbox under its own key', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(milestone));

    expect(prisma.updates[0].where.dedupeKey).toBe(
      'milestone:app1:kw1:2026-07-22',
    );
    expect(prisma.updates[0].data).toEqual({
      event: 'rank.milestone',
      appId: 'app1',
      payload: milestone,
    });
  });

  it('collects a chart entry into the outbox under its chart key', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(chartEntered()));

    expect(prisma.updates[0].where.dedupeKey).toBe(
      'chart:a:free:6007:2026-07-22',
    );
    expect(prisma.updates[0].data).toEqual({
      event: 'chart.entered',
      appId: 'a',
      payload: chartEntered(),
    });
  });

  it('queues a chart entry per subscribed webhook in instant mode', async () => {
    const prisma = buildPrisma();
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'wh1', events: ['chart.entered'], reviewScores: [] },
    ]);
    const { add, queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('instant'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(chartEntered()));

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: { active: true, events: { has: 'chart.entered' } },
      select: { id: true, events: true, reviewScores: true },
    });
    expect(add).toHaveBeenCalledWith(
      JOBS.DELIVER_ALERT,
      expect.objectContaining({ webhookId: 'wh1', payload: chartEntered() }),
      { backoff: { type: 'custom' } },
    );
  });

  it('looks up the subscribers of an overtake in instant mode', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('instant'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(overtake));

    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: { active: true, events: { has: 'rank.overtaken' } },
      select: { id: true, events: true, reviewScores: true },
    });
  });

  it('fans an instant event out only to confirmed, active email alerts', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('instant'),
      queue,
      workspace,
      new AlertAppIdentities(prisma as unknown as PrismaService),
    );

    await inWorkspace(() => dispatcher.dispatch(overtake));

    expect(prisma.emailAlert.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        confirmedAt: { not: null },
        events: { has: 'rank.overtaken' },
      },
      select: { id: true, events: true, reviewScores: true },
    });
  });

  describe('review alerts in instant mode', () => {
    const instant = (prisma: ReturnType<typeof buildPrisma>, mail = true) => {
      const { add, queue } = buildQueue();
      const dispatcher = new AlertsDispatcher(
        prisma as unknown as PrismaService,
        { enabled: mail } as MailerService,
        buildConfig('instant'),
        queue,
        workspace,
        new AlertAppIdentities(prisma as unknown as PrismaService),
      );
      return { add, dispatcher };
    };
    const queued = (add: jest.Mock, key: 'webhookId' | 'emailAlertId') =>
      add.mock.calls.map(
        ([, data]: [string, Record<string, unknown>]) => data[key],
      );

    it('queues a new review only for the webhooks whose stars cover it', async () => {
      const prisma = buildPrisma();
      prisma.webhook.findMany.mockResolvedValue([
        { id: 'every', events: ['review.new'], reviewScores: [] },
        { id: 'low', events: ['review.new'], reviewScores: [1, 2] },
        { id: 'top', events: ['review.new'], reviewScores: [5] },
      ]);
      const { add, dispatcher } = instant(prisma, false);

      await inWorkspace(() => dispatcher.dispatch(newReview));

      expect(queued(add, 'webhookId')).toEqual(['every', 'top']);
    });

    it('skips a negative review a webhook already lists as new', async () => {
      const prisma = buildPrisma();
      prisma.webhook.findMany.mockResolvedValue([
        {
          id: 'both',
          events: ['review.new', 'review.negative'],
          reviewScores: [],
        },
        {
          id: 'praise',
          events: ['review.new', 'review.negative'],
          reviewScores: [4, 5],
        },
        { id: 'negative', events: ['review.negative'], reviewScores: [] },
      ]);
      const { add, dispatcher } = instant(prisma, false);

      await inWorkspace(() => dispatcher.dispatch(negative));

      expect(queued(add, 'webhookId')).toEqual(['praise', 'negative']);
    });

    it('routes email alerts by the same rule', async () => {
      const prisma = buildPrisma();
      prisma.emailAlert.findMany.mockResolvedValue([
        {
          id: 'both',
          events: ['review.new', 'review.negative'],
          reviewScores: [],
        },
        { id: 'negative', events: ['review.negative'], reviewScores: [] },
      ]);
      const { add, dispatcher } = instant(prisma);

      await inWorkspace(() => dispatcher.dispatch(negative));

      expect(queued(add, 'emailAlertId')).toEqual(['negative']);
    });
  });

  describe('listensTo', () => {
    const listener = (prisma: ReturnType<typeof buildPrisma>, mail: boolean) =>
      new AlertsDispatcher(
        prisma as unknown as PrismaService,
        { enabled: mail } as MailerService,
        buildConfig('batched'),
        buildQueue().queue,
        workspace,
        new AlertAppIdentities(prisma as unknown as PrismaService),
      );

    it('listens while an active webhook holds the event', async () => {
      const prisma = buildPrisma();
      prisma.webhook.count.mockResolvedValue(1);

      await expect(
        listener(prisma, true).listensTo('review.new'),
      ).resolves.toBe(true);
      expect(prisma.webhook.count).toHaveBeenCalledWith({
        where: { active: true, events: { has: 'review.new' } },
      });
      expect(prisma.emailAlert.count).not.toHaveBeenCalled();
    });

    it('listens to a deliverable email alert only while mail is on', async () => {
      const prisma = buildPrisma();
      prisma.emailAlert.count.mockResolvedValue(1);

      await expect(
        listener(prisma, true).listensTo('review.new'),
      ).resolves.toBe(true);
      expect(prisma.emailAlert.count).toHaveBeenCalledWith({
        where: {
          active: true,
          confirmedAt: { not: null },
          events: { has: 'review.new' },
        },
      });
      await expect(
        listener(prisma, false).listensTo('review.new'),
      ).resolves.toBe(false);
    });

    it('does not listen without a subscriber', async () => {
      await expect(
        listener(buildPrisma(), true).listensTo('review.new'),
      ).resolves.toBe(false);
    });
  });

  describe('with the app identity', () => {
    const identity = {
      iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/icon/512x512bb.jpg',
      store: 'APP_STORE',
      country: 'gb',
    };

    const identified = () => {
      const prisma = buildPrisma();
      prisma.app.findUnique.mockResolvedValue(identity);
      return prisma;
    };

    it('adds the icon and storefront to the queued instant job', async () => {
      const prisma = identified();
      prisma.webhook.findMany.mockResolvedValue([
        { id: 'wh1', events: ['rank.dropped'], reviewScores: [] },
      ]);
      const { add, queue } = buildQueue();
      const dispatcher = new AlertsDispatcher(
        prisma as unknown as PrismaService,
        { enabled: false } as MailerService,
        buildConfig('instant'),
        queue,
        workspace,
        new AlertAppIdentities(prisma as unknown as PrismaService),
      );

      await inWorkspace(() => dispatcher.dispatch(rankPayload));

      expect(prisma.app.findUnique).toHaveBeenCalledWith({
        where: { id: 'app1' },
        select: { iconUrl: true, store: true, country: true },
      });
      expect(add).toHaveBeenCalledWith(
        JOBS.DELIVER_ALERT,
        expect.objectContaining({
          webhookId: 'wh1',
          payload: { ...rankPayload, app: { ...rankPayload.app, ...identity } },
        }),
        { backoff: { type: 'custom' } },
      );
    });

    it('stores the icon and storefront in the outbox row', async () => {
      const prisma = identified();
      const { queue } = buildQueue();
      const dispatcher = new AlertsDispatcher(
        prisma as unknown as PrismaService,
        { enabled: true } as MailerService,
        buildConfig('batched'),
        queue,
        workspace,
        new AlertAppIdentities(prisma as unknown as PrismaService),
      );

      await inWorkspace(() => dispatcher.dispatch(rankPayload));

      expect(prisma.updates[0].data.payload.app).toEqual({
        id: 'app1',
        name: 'App One',
        ...identity,
      });
    });

    it('reads no app for an event that names none', async () => {
      const prisma = identified();
      const { queue } = buildQueue();
      const dispatcher = new AlertsDispatcher(
        prisma as unknown as PrismaService,
        { enabled: false } as MailerService,
        buildConfig('instant'),
        queue,
        workspace,
        new AlertAppIdentities(prisma as unknown as PrismaService),
      );

      await inWorkspace(() =>
        dispatcher.dispatch({
          event: 'serp.entrant',
          occurredAt: '2026-07-22T10:00:00.000Z',
          keyword: milestone.keyword,
          date: '2026-07-22',
          entrants: [],
        }),
      );

      expect(prisma.app.findUnique).not.toHaveBeenCalled();
      expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
