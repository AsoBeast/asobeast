import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AlertBatchApp,
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertDeliveryStatus,
  AlertFlushResult,
  CHANGE_FIELD_LABELS,
  CHANGE_FIELDS,
  ChangeDetail,
  ChangeEventItem,
  EmailAlertCreateRequest,
  EmailAlertItem,
  EmailAlertUpdateRequest,
  GranularAlertPayload,
  isChangeField,
  RankDroppedPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  WEBHOOK_EVENTS,
  WebhookCreateRequest,
  WebhookItem,
  WebhookUpdateRequest,
} from './changes';
import type { ChartLeftPayload, ChartMovePayload } from './charts';
import type { ReviewNegativePayload, ReviewNewPayload } from './reviews';

const batch = (scope: AlertBatchPayload['scope']): AlertBatchPayload => ({
  event: 'alerts.batch',
  scope,
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: {
    from: '2026-07-22T09:00:00.000Z',
    to: '2026-07-22T11:00:00.000Z',
  },
  totals: { events: 0, apps: 0 },
  apps: [],
  events: [],
});

describe('alert contracts', () => {
  it('groups the rank events right after rank.improved', () => {
    expect(WEBHOOK_EVENTS).toEqual([
      'metadata.changed',
      'rank.dropped',
      'rank.improved',
      'rank.milestone',
      'rank.first',
      'rank.overtaken',
      'review.negative',
      'digest.weekly',
      'serp.entrant',
      'action.opened',
      'chart.entered',
      'chart.left',
      'chart.milestone',
      'review.new',
    ]);
  });

  it('carries the author on a new review and not on a negative one', () => {
    expectTypeOf<ReviewNewPayload['review']['author']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<ReviewNegativePayload['review']>().not.toHaveProperty(
      'author',
    );
  });

  it('keeps the new review group and the star filter optional', () => {
    expectTypeOf<AlertBatchAppSection['newReviews']>().toEqualTypeOf<
      ReviewNewPayload[] | undefined
    >();
    expectTypeOf<WebhookCreateRequest['reviewScores']>().toEqualTypeOf<
      number[] | undefined
    >();
    expectTypeOf<{
      url: string;
      events: ['review.new'];
    }>().toExtend<WebhookCreateRequest>();
  });

  it('requires one of the two delivery scopes', () => {
    expect([batch('owned_apps').scope, batch('competitors').scope]).toEqual([
      'owned_apps',
      'competitors',
    ]);
  });

  it('distinguishes rows, channels and notifications', () => {
    const result: AlertFlushResult = {
      flushed: 8,
      channels: 3,
      notifications: 5,
    };

    expect(result).toEqual({ flushed: 8, channels: 3, notifications: 5 });
  });

  it('describes completion-driven delivery and claimed work', () => {
    const status: AlertDeliveryStatus = {
      mode: 'batched',
      pipelineCron: '0 3 * * *',
      trigger: 'daily_pipeline_completion',
      lastFlushAt: null,
      pending: 4,
      claimed: 2,
    };

    expect(status).toMatchObject({
      trigger: 'daily_pipeline_completion',
      pending: 4,
      claimed: 2,
    });
  });
});

describe('CHANGE_FIELD_LABELS', () => {
  it('names every change field in its order', () => {
    expect(Object.keys(CHANGE_FIELD_LABELS)).toEqual([...CHANGE_FIELDS]);
  });

  it('names a field the way the store consoles do', () => {
    expect(CHANGE_FIELD_LABELS.summary).toBe('Short description');
    expect(CHANGE_FIELD_LABELS.whatsNew).toBe("What's new");
  });
});

describe('isChangeField', () => {
  it('accepts every known change field', () => {
    expect(CHANGE_FIELDS.every((field) => isChangeField(field))).toBe(true);
  });

  it('rejects a field the contract does not name', () => {
    expect(isChangeField('legacyField')).toBe(false);
  });
});

const LEGACY_CHANGE_FIELDS = [
  'title',
  'subtitle',
  'summary',
  'description',
  'version',
  'price',
  'screenshots',
  'icon',
  'whatsNew',
];

describe('the screenshot change fields', () => {
  it('keeps every field released before them in its original order', () => {
    expect(
      CHANGE_FIELDS.filter((field) => LEGACY_CHANGE_FIELDS.includes(field)),
    ).toEqual(LEGACY_CHANGE_FIELDS);
  });

  it('places the two new fields right after screenshots', () => {
    const at = CHANGE_FIELDS.indexOf('screenshots');
    expect(CHANGE_FIELDS.slice(at, at + 3)).toEqual([
      'screenshots',
      'screenshotImages',
      'screenshotCaptions',
    ]);
  });

  it('recognises both new fields', () => {
    expect(isChangeField('screenshotImages')).toBe(true);
    expect(isChangeField('screenshotCaptions')).toBe(true);
  });

  it('lets an event carry a detail without requiring one', () => {
    const detail: ChangeDetail = {
      kind: 'captions',
      added: ['Track habits'],
      removed: [],
    };
    const plain: ChangeEventItem = {
      id: 'e1',
      appId: 'a1',
      appName: null,
      isCompetitor: false,
      field: 'screenshots',
      before: '4',
      after: '5',
      capturedAt: '2026-10-07T00:00:00.000Z',
    };
    expect({ ...plain, detail }.detail).toBe(detail);
    expect(plain.detail).toBeUndefined();
  });
});

describe('the alert app identity', () => {
  it('lets every alert app carry an icon without requiring one', () => {
    expectTypeOf<AlertBatchApp['iconUrl']>().toEqualTypeOf<
      string | null | undefined
    >();
    const drop: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: '2026-10-24T03:10:00.000Z',
      app: { id: 'a1', name: 'Habit' },
      keyword: { id: 'k1', text: 'habit', store: 'APP_STORE', country: 'us' },
      from: 3,
      to: 12,
      fromDepth: 200,
      toDepth: 200,
      threshold: 5,
    };
    expect(drop.app.iconUrl).toBeUndefined();
  });

  it('keeps the store and storefront of a batch app required', () => {
    expectTypeOf<AlertBatchApp['store']>().toEqualTypeOf<
      'APP_STORE' | 'GOOGLE_PLAY'
    >();
    expectTypeOf<AlertBatchApp['country']>().toEqualTypeOf<string>();
  });
});

describe('the confirmed drop fields', () => {
  const app = { id: 'a1', name: 'Habit' };
  const keyword = {
    id: 'k1',
    text: 'habit',
    store: 'APP_STORE',
    country: 'us',
  } as const;

  it('keeps the setting optional on every request and item', () => {
    expectTypeOf<WebhookCreateRequest['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<WebhookUpdateRequest['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<WebhookItem['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<EmailAlertCreateRequest['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<EmailAlertUpdateRequest['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<EmailAlertItem['confirmDrops']>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it('lets a plain drop, improvement and milestone omit the markers', () => {
    const drop: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: '2026-10-28T03:10:00.000Z',
      app,
      keyword,
      from: 9,
      to: 15,
      fromDepth: 200,
      toDepth: 200,
      threshold: 5,
    };
    const improvement: RankImprovedPayload = {
      event: 'rank.improved',
      occurredAt: '2026-10-28T03:10:00.000Z',
      app,
      keyword,
      from: 15,
      to: 9,
      fromDepth: 200,
      toDepth: 200,
      threshold: 5,
    };
    const milestone: RankMilestonePayload = {
      event: 'rank.milestone',
      occurredAt: '2026-10-28T03:10:00.000Z',
      app,
      keyword,
      tier: 10,
      direction: 'left',
      from: 9,
      to: 11,
      fromDepth: 200,
      toDepth: 200,
    };
    expect(drop.confirmed).toBeUndefined();
    expect(improvement.undoesDrop).toBeUndefined();
    expect(milestone.confirmed).toBeUndefined();
    expect(milestone.undoesDrop).toBeUndefined();
  });

  it('types the markers as booleans', () => {
    expectTypeOf<RankDroppedPayload['confirmed']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<RankImprovedPayload['undoesDrop']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<RankMilestonePayload['confirmed']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<RankMilestonePayload['undoesDrop']>().toEqualTypeOf<
      boolean | undefined
    >();
  });
});

describe('the chart alert events', () => {
  it('carries chart moves on a section without requiring them', () => {
    expectTypeOf<AlertBatchAppSection['chartMoves']>().toEqualTypeOf<
      ChartMovePayload[] | undefined
    >();
  });

  it('narrows a granular payload to a chart exit by its event', () => {
    const narrow = (payload: GranularAlertPayload) =>
      payload.event === 'chart.left' ? payload : null;

    expectTypeOf(narrow).returns.toEqualTypeOf<ChartLeftPayload | null>();
  });
});
