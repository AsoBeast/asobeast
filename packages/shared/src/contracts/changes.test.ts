import { describe, expect, it } from 'vitest';
import {
  AlertBatchPayload,
  AlertDeliveryStatus,
  AlertFlushResult,
  CHANGE_FIELDS,
  ChangeDetail,
  ChangeEventItem,
  isChangeField,
  WEBHOOK_EVENTS,
} from './changes';

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
    ]);
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
