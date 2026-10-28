import {
  ActionOpenedPayload,
  AlertPayload,
  RankDroppedPayload,
  RankFirstPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
} from '@asobeast/shared';

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

const rankKey = (payload: RankDroppedPayload | RankImprovedPayload): string => {
  const prefix =
    payload.event === 'rank.dropped' && payload.confirmed === true
      ? 'rank.confirmed'
      : 'rank';
  return `${prefix}:${payload.app.id}:${payload.keyword.id}:${dayOf(payload.occurredAt)}`;
};

const milestoneKey = (payload: RankMilestonePayload): string => {
  const prefix =
    payload.confirmed === true ? 'milestone.confirmed' : 'milestone';
  return `${prefix}:${payload.app.id}:${payload.keyword.id}:${dayOf(payload.occurredAt)}`;
};

function hash(input: string): string {
  let value = 5381;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 33) ^ input.charCodeAt(i);
  }
  return (value >>> 0).toString(36);
}

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
    return [
      {
        event: payload.event,
        appId: payload.app.id,
        dedupeKey: rankKey(payload),
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
        dedupeKey: actionOpenedKey(payload),
        payload,
      },
    ];
  }

  if (payload.event === 'rank.milestone') {
    return [appRow(payload, milestoneKey(payload))];
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
