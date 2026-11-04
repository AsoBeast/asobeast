import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { DefaultAlertsMarker } from './default-alerts-marker';
import type { WebhookDelivery } from './webhook-delivery';
import { WebhooksService } from './webhooks.service';

const stored = {
  id: 'wh_1',
  workspaceId: 'ws_1',
  url: 'https://hooks.example.com/asobeast',
  events: ['rank.dropped'],
  reviewScores: [],
  secret: null,
  active: true,
  confirmDrops: false,
  ratingDropTenths: null,
  rankDropThreshold: null,
  createdAt: new Date('2026-11-04T05:00:00.000Z'),
};

const build = () => {
  const tx = { webhook: { create: jest.fn().mockResolvedValue(stored) } };
  const withTransaction = jest.fn(
    async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  );
  const update = jest.fn().mockResolvedValue(stored);
  const claim = jest.fn().mockResolvedValue(true);
  const service = new WebhooksService(
    { withTransaction, webhook: { update } } as unknown as PrismaService,
    { assertTarget: jest.fn() } as unknown as WebhookDelivery,
    { require: jest.fn(() => 'ws_1') } as unknown as WorkspaceContext,
    { claim } as unknown as DefaultAlertsMarker,
  );
  return { service, tx, withTransaction, claim };
};

describe('WebhooksService and the default alerts marker', () => {
  it('writes the webhook and settles the marker in one transaction', async () => {
    const { service, tx, withTransaction, claim } = build();

    await service.create({ url: stored.url, events: ['rank.dropped'] });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith(tx);
    expect(tx.webhook.create.mock.invocationCallOrder[0]).toBeLessThan(
      claim.mock.invocationCallOrder[0],
    );
  });

  it('never settles the marker on an update', async () => {
    const { service, claim } = build();

    await service.update('wh_1', { events: ['rank.first'] });

    expect(claim).not.toHaveBeenCalled();
  });
});
