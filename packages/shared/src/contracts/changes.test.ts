import { describe, expect, it } from 'vitest';
import {
  AlertBatchPayload,
  AlertDeliveryStatus,
  AlertFlushResult,
  CHANGE_FIELDS,
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
