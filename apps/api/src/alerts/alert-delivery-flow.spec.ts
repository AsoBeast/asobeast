import { AlertBatchPayload, GranularAlertPayload } from '@asobeast/shared';
import { JOBS } from '../jobs/jobs.types';
import { assembleBatches } from './alert-batch';
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
import { drop, milestone } from './rank-events.fixture';

const batchesOf = (payloads: GranularAlertPayload[]) =>
  assembleBatches({
    events: payloads.map((payload, index) => ({
      id: `e${index}`,
      event: payload.event,
      appId: 'a',
      payload,
      createdAt: new Date('2026-07-22T09:00:00.000Z'),
    })),
    appById: new Map([
      [
        'a',
        {
          id: 'a',
          name: 'My App',
          iconUrl: null,
          store: 'APP_STORE',
          country: 'us',
          isCompetitor: false,
          primaryAppId: null,
        },
      ],
    ]),
    serpPrimariesByKeyword: new Map(),
    now: new Date('2026-07-22T11:00:00.000Z'),
  });

const deliveredEvents = (
  payloads: GranularAlertPayload[],
  confirmDrops?: boolean,
) =>
  createDeliveryFlows({
    batches: batchesOf(payloads),
    workspaceId: 'ws_1',
    flushId: 'f1',
    kind: 'webhook',
    subscription: {
      id: 'wh1',
      events: ['rank.dropped', 'rank.milestone'],
      confirmDrops,
    },
    jobName: JOBS.DELIVER_ALERT,
  }).map(
    ({ flow }) => (flow.data as { payload: AlertBatchPayload }).payload.events,
  );

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
        reviewScores: [],
      },
      jobName: JOBS.DELIVER_ALERT,
    });

    expect(flow.opts?.backoff).toEqual({ type: 'custom' });
    expect(flow.children?.[0].opts?.backoff).toEqual({ type: 'custom' });
    expect(flow.opts?.attempts).toBe(3);
  });

  describe('with confirmed drops', () => {
    const ordinary = drop();
    const confirmed = drop({ confirmed: true });
    const confirmedLeave = milestone({
      direction: 'left',
      from: 9,
      to: 15,
      confirmed: true,
    });

    it('gives a confirming subscription only the confirmed events', () => {
      expect(
        deliveredEvents([ordinary, confirmed, confirmedLeave], true),
      ).toEqual([[confirmed, confirmedLeave]]);
    });

    it('gives a plain subscription only the ordinary events', () => {
      expect(deliveredEvents([ordinary, confirmed, confirmedLeave])).toEqual([
        [ordinary],
      ]);
    });

    it('builds no flow for a confirming subscription with nothing to receive', () => {
      expect(deliveredEvents([ordinary], true)).toEqual([]);
    });
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
