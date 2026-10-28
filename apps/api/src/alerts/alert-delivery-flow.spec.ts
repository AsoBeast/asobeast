import { JOBS } from '../jobs/jobs.types';
import { createDeliveryFlows } from './alert-delivery-flow';
import type { AlertBatchPayload } from '@asobeast/shared';
import {
  alpha,
  batch,
  competitorAlpha,
  competitorBatch,
  emptySection,
  newReview,
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

  it('carries only the stars a channel picked', () => {
    const scored = (score: number) => ({
      ...newReview,
      review: { ...newReview.review, score, text: `${score} stars` },
    });
    const reviews = [scored(5), scored(3), scored(5)];
    const owned: AlertBatchPayload = {
      ...batch,
      totals: { events: 3, apps: 1 },
      apps: [{ ...emptySection(alpha.app), newReviews: reviews }],
      events: reviews,
    };

    const [{ flow }] = createDeliveryFlows({
      batches: { owned, competitors: { ...competitorBatch, events: [] } },
      workspaceId: 'ws_1',
      flushId: 'f1',
      kind: 'webhook',
      subscription: { id: 'wh1', events: ['review.new'], reviewScores: [5] },
      jobName: JOBS.DELIVER_ALERT,
    });
    const { payload } = flow.data as { payload: AlertBatchPayload };

    expect(payload.apps[0].newReviews).toEqual([reviews[0], reviews[2]]);
    expect(payload.events).toEqual([reviews[0], reviews[2]]);
    expect(payload.totals.events).toBe(2);
  });
});
