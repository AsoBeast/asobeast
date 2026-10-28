import {
  ActionOpenedPayload,
  AlertPayload,
  RankFirstPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
} from '@asobeast/shared';
import { reviewKey } from './review-fingerprint';

export interface OutboxRow {
  event: string;
  appId: string | null;
  dedupeKey: string;
  payload: AlertPayload;
}

function dayOf(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

const actionOpenedKey = (payload: ActionOpenedPayload): string =>
  payload.action.reopened
    ? `action.opened~${payload.action.id}~${dayOf(payload.occurredAt)}`
    : `action.opened~${payload.action.id}`;

function appRow(
  payload: RankMilestonePayload | RankFirstPayload | RankOvertakenPayload,
  dedupeKey: string,
): OutboxRow {
  return { event: payload.event, appId: payload.app.id, dedupeKey, payload };
}

export function outboxRows(payload: AlertPayload): OutboxRow[] {
  if (payload.event === 'metadata.changed') {
    const day = dayOf(payload.occurredAt);
    return payload.changes.map((change) => ({
      event: payload.event,
      appId: payload.app.id,
      dedupeKey: `change:${payload.app.id}:${change.field}:${day}`,
      payload: { ...payload, changes: [change] },
    }));
  }

  if (payload.event === 'rank.dropped' || payload.event === 'rank.improved') {
    const day = dayOf(payload.occurredAt);
    return [
      {
        event: payload.event,
        appId: payload.app.id,
        dedupeKey: `rank:${payload.app.id}:${payload.keyword.id}:${day}`,
        payload,
      },
    ];
  }

  if (payload.event === 'review.negative') {
    return [
      {
        event: payload.event,
        appId: payload.app.id,
        dedupeKey: `review:${reviewKey(payload)}`,
        payload,
      },
    ];
  }

  if (payload.event === 'serp.entrant') {
    return [
      {
        event: payload.event,
        appId: null,
        dedupeKey: `entrant:${payload.keyword.id}:${payload.date}`,
        payload,
      },
    ];
  }

  if (payload.event === 'action.opened') {
    return [
      {
        event: payload.event,
        appId: payload.app.id,
        dedupeKey: actionOpenedKey(payload),
        payload,
      },
    ];
  }

  if (payload.event === 'rank.milestone') {
    const day = dayOf(payload.occurredAt);
    return [
      appRow(
        payload,
        `milestone:${payload.app.id}:${payload.keyword.id}:${day}`,
      ),
    ];
  }

  if (payload.event === 'rank.first') {
    const day = dayOf(payload.occurredAt);
    return [
      appRow(payload, `first:${payload.app.id}:${payload.keyword.id}:${day}`),
    ];
  }

  if (payload.event === 'rank.overtaken') {
    const day = dayOf(payload.occurredAt);
    return [
      appRow(
        payload,
        `overtaken:${payload.app.id}:${payload.keyword.id}:${payload.competitor.id}:${day}`,
      ),
    ];
  }

  return [];
}
