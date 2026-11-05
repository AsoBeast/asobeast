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
import { appDelisted, ratingDropped } from './listing-events.fixture';
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
    instanceThreshold: 5,
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
      instanceThreshold: 5,
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
      instanceThreshold: 5,
      jobName: JOBS.DELIVER_ALERT,
    });
    const { payload } = flow.data as { payload: AlertBatchPayload };

    expect(payload.apps[0].newReviews).toEqual([reviews[0], reviews[2]]);
    expect(payload.events).toEqual([reviews[0], reviews[2]]);
    expect(payload.totals.events).toBe(2);
  });
});

describe('createDeliveryFlows with a rating drop threshold', () => {
  it('carries only the drops at or above the threshold', () => {
    const small = ratingDropped({ dropTenths: 1 });
    const large = ratingDropped({ dropTenths: 3, toDate: '2026-11-04' });

    const flows = createDeliveryFlows({
      batches: batchesOf([small, large]),
      workspaceId: 'ws_1',
      flushId: 'f1',
      kind: 'email',
      subscription: {
        id: 'ea1',
        events: ['rating.dropped'],
        reviewScores: [],
        ratingDropTenths: 3,
      },
      instanceThreshold: 5,
      jobName: JOBS.DELIVER_EMAIL,
    });
    const { payload } = flows[0].flow.data as { payload: AlertBatchPayload };

    expect(flows).toHaveLength(1);
    expect(payload.events).toEqual([large]);
    expect(payload.apps[0].ratingDrops).toEqual([large]);
  });

  it('builds no flow when every drop is below the threshold', () => {
    expect(
      createDeliveryFlows({
        batches: batchesOf([ratingDropped({ dropTenths: 1 })]),
        workspaceId: 'ws_1',
        flushId: 'f1',
        kind: 'email',
        subscription: {
          id: 'ea1',
          events: ['rating.dropped'],
          reviewScores: [],
          ratingDropTenths: 2,
        },
        instanceThreshold: 5,
        jobName: JOBS.DELIVER_EMAIL,
      }),
    ).toEqual([]);
  });
});

describe('createDeliveryFlows with availability events', () => {
  it('sends an own delisting in the owned job', () => {
    const flows = createDeliveryFlows({
      batches: batchesOf([appDelisted()]),
      workspaceId: 'ws_1',
      flushId: 'f1',
      kind: 'webhook',
      subscription: {
        id: 'wh1',
        events: ['app.delisted', 'app.unlisted_market', 'metadata.changed'],
        reviewScores: [],
      },
      instanceThreshold: 5,
      jobName: JOBS.DELIVER_ALERT,
    });
    const { payload } = flows[0].flow.data as { payload: AlertBatchPayload };

    expect(payload.scope).toBe('owned_apps');
    expect(payload.apps[0].availability).toEqual([appDelisted()]);
  });
});

describe('createDeliveryFlows with a rank drop threshold', () => {
  const moves = [
    drop({ from: 4, to: 10, keyword: { ...drop().keyword, id: 'k1' } }),
    drop({ from: 4, to: 20, keyword: { ...drop().keyword, id: 'k2' } }),
  ];
  const deliver = (rankDropThreshold: number | null) =>
    createDeliveryFlows({
      batches: batchesOf(moves),
      workspaceId: 'ws_1',
      flushId: 'f1',
      kind: 'email',
      subscription: {
        id: 'ea1',
        events: ['rank.dropped'],
        reviewScores: [],
        rankDropThreshold,
      },
      instanceThreshold: 5,
      jobName: JOBS.DELIVER_EMAIL,
    }).map(({ flow }) => (flow.data as { payload: AlertBatchPayload }).payload);

  it('carries only the moves the subscription asks for', () => {
    const [payload] = deliver(10);

    expect(payload.events).toEqual([
      expect.objectContaining({ to: 20, threshold: 10 }),
    ]);
  });

  it('carries every move at the instance value without one', () => {
    const [payload] = deliver(null);

    expect(payload.events).toHaveLength(2);
  });
});
