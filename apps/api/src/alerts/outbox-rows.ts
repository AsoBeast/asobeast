import { AlertPayload } from '@asobeast/shared';

export interface OutboxRow {
  event: string;
  appId: string | null;
  dedupeKey: string;
  payload: AlertPayload;
}

function dayOf(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

function hash(input: string): string {
  let value = 5381;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 33) ^ input.charCodeAt(i);
  }
  return (value >>> 0).toString(36);
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
    const fingerprint = hash(
      `${payload.review.reviewedAt ?? ''}|${payload.review.title ?? ''}|${payload.review.text}`,
    );
    return [
      {
        event: payload.event,
        appId: payload.app.id,
        dedupeKey: `review:${payload.app.id}:${fingerprint}`,
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
        dedupeKey: `action.opened~${payload.action.id}`,
        payload,
      },
    ];
  }

  return [];
}
