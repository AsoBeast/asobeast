import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { InstantDeliveries } from './instant-deliveries';
import { appDelisted, ratingDropped } from './listing-events.fixture';
import { MailerService } from './mailer.service';

const subscription = (id: string, overrides: object = {}) => ({
  id,
  events: ['app.delisted', 'rating.dropped'],
  reviewScores: [],
  ratingDropTenths: null,
  rankDropThreshold: null,
  ...overrides,
});

const build = ({
  mail = true,
  webhooks = [subscription('w1')],
  emails = [subscription('e1')],
}: {
  mail?: boolean;
  webhooks?: object[];
  emails?: object[];
} = {}) => {
  const prisma = {
    webhook: { findMany: jest.fn().mockResolvedValue(webhooks) },
    emailAlert: { findMany: jest.fn().mockResolvedValue(emails) },
  };
  const add = jest.fn().mockResolvedValue({});
  const workspace = new WorkspaceContext();
  const deliveries = new InstantDeliveries(
    prisma as unknown as PrismaService,
    { enabled: mail } as MailerService,
    { get: jest.fn(() => 5) } as unknown as ConfigService<Env, true>,
    { add } as unknown as Queue<DeliverAlertPayload | DeliverEmailPayload>,
    workspace,
  );
  const inWorkspace = (work: () => Promise<void>) =>
    workspace.run(DEFAULT_WORKSPACE_ID, work);
  return { prisma, add, deliveries, inWorkspace };
};

describe('InstantDeliveries', () => {
  it('passes the job options it is given for each channel and subscription', async () => {
    const { add, deliveries, inWorkspace } = build();

    await inWorkspace(() =>
      deliveries.enqueue(appDelisted(), (channel, id) => ({
        jobId: `${channel}~${id}`,
      })),
    );

    expect(add).toHaveBeenCalledWith(
      JOBS.DELIVER_ALERT,
      expect.objectContaining({ webhookId: 'w1' }),
      { jobId: 'webhook~w1' },
    );
    expect(add).toHaveBeenCalledWith(
      JOBS.DELIVER_EMAIL,
      expect.objectContaining({ emailAlertId: 'e1' }),
      { jobId: 'email~e1' },
    );
  });

  it('keeps an immediate delivery for the whole dedupe window, never trimmed by count', async () => {
    const { add, deliveries, inWorkspace } = build({ emails: [] });

    await inWorkspace(() => deliveries.enqueue(appDelisted()));

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      JOBS.DELIVER_ALERT,
      expect.objectContaining({ webhookId: 'w1' }),
      expect.objectContaining({
        backoff: { type: 'custom' },
        removeOnComplete: { age: 604800 },
      }),
    );
  });

  it('enqueues no email when mail is disabled and still enqueues webhooks', async () => {
    const { prisma, add, deliveries, inWorkspace } = build({ mail: false });

    await inWorkspace(() => deliveries.enqueue(appDelisted()));

    expect(prisma.emailAlert.findMany).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      JOBS.DELIVER_ALERT,
      expect.objectContaining({ webhookId: 'w1' }),
      expect.anything(),
    );
  });

  it('enqueues nothing for a subscription whose rating drop threshold the drop misses', async () => {
    const { add, deliveries, inWorkspace } = build({
      webhooks: [subscription('w1', { ratingDropTenths: 3 })],
      emails: [],
    });

    await inWorkspace(() =>
      deliveries.enqueue(ratingDropped({ dropTenths: 1 })),
    );

    expect(add).not.toHaveBeenCalled();
  });
});
