import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { RANK_DEPTH, RankDroppedPayload } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { Env } from '../config/env';
import { DeliverAlertPayload, DeliverEmailPayload } from '../jobs/jobs.types';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsDispatcher } from './alerts.dispatcher';
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
    webhook: { findMany: jest.fn().mockResolvedValue([]) },
    emailAlert: { findMany: jest.fn().mockResolvedValue([]) },
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
    );

    await inWorkspace(() => dispatcher.dispatch(rankPayload));

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
  });
});
