import { JOBS } from '../jobs/jobs.types';
import { createDeliveryFlows } from './alert-delivery-flow';
import {
  alpha,
  batch,
  competitorAlpha,
  competitorBatch,
} from './email-fixtures.fixture';

describe('createDeliveryFlows', () => {
  it('lets every delivery job wait as long as a chat service asks', () => {
    const [{ flow }] = createDeliveryFlows({
      batches: {
        owned: { ...batch, events: alpha.rankDrops },
        competitors: {
          ...competitorBatch,
          events: competitorAlpha.competitors[0].changes,
        },
      },
      workspaceId: 'ws_1',
      flushId: 'f1',
      kind: 'webhook',
      subscription: {
        id: 'wh1',
        events: ['rank.dropped', 'metadata.changed', 'serp.entrant'],
      },
      jobName: JOBS.DELIVER_ALERT,
    });

    expect(flow.opts?.backoff).toEqual({ type: 'custom' });
    expect(flow.children?.[0].opts?.backoff).toEqual({ type: 'custom' });
    expect(flow.opts?.attempts).toBe(3);
  });
});
