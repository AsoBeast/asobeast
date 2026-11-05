import {
  ActionOpenedPayload,
  AlertPayload,
  AppAvailabilityPayload,
  ChartMovePayload,
  isChartMovePayload,
  RankDroppedPayload,
  RankFirstPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
  RatingDroppedPayload,
  ReviewSpikePayload,
} from '@asobeast/shared';
import {
  newReviewKey,
  ReviewAlertPayload,
  reviewKey,
} from './review-fingerprint';

export interface OutboxRow {
  event: string;
  appId: string | null;
  keywordId: string | null;
  dedupeKey: string;
  payload: AlertPayload;
}

type KeylessRow = Omit<OutboxRow, 'keywordId'>;

const CONFIRMED_RANK_KEY = 'rank.confirmed';
const CONFIRMED_MILESTONE_KEY = 'milestone.confirmed';

export const CONFIRMED_KEY_PREFIXES = [
  `${CONFIRMED_RANK_KEY}:`,
  `${CONFIRMED_MILESTONE_KEY}:`,
] as const;

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
      ? CONFIRMED_RANK_KEY
      : 'rank';
  return `${prefix}:${payload.app.id}:${payload.keyword.id}:${dayOf(payload.occurredAt)}`;
};

const milestoneKey = (payload: RankMilestonePayload): string => {
  const prefix =
    payload.confirmed === true ? CONFIRMED_MILESTONE_KEY : 'milestone';
  return `${prefix}:${payload.app.id}:${payload.keyword.id}:${dayOf(payload.occurredAt)}`;
};

function appRow(
  payload:
    | RankMilestonePayload
    | RankFirstPayload
    | RankOvertakenPayload
    | ReviewAlertPayload
    | RatingDroppedPayload
    | ReviewSpikePayload
    | AppAvailabilityPayload,
  dedupeKey: string,
): KeylessRow {
  return { event: payload.event, appId: payload.app.id, dedupeKey, payload };
}

function chartRow(payload: ChartMovePayload, prefix: string): KeylessRow {
  const { app, chart, date } = payload;
  return {
    event: payload.event,
    appId: app.id,
    dedupeKey: `${prefix}:${app.id}:${chart.collection}:${chart.genre}:${date}`,
    payload,
  };
}

function keywordIdOf(payload: AlertPayload): string | null {
  return 'keyword' in payload && payload.keyword ? payload.keyword.id : null;
}

export function outboxRows(payload: AlertPayload): OutboxRow[] {
  return rowsOf(payload).map((row) => ({
    ...row,
    keywordId: keywordIdOf(row.payload),
  }));
}

function rowsOf(payload: AlertPayload): KeylessRow[] {
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
    return [appRow(payload, `review:${reviewKey(payload)}`)];
  }

  if (payload.event === 'review.new') {
    return [appRow(payload, `review.new:${newReviewKey(payload)}`)];
  }

  if (payload.event === 'rating.dropped') {
    return [
      appRow(
        payload,
        `rating.dropped:${payload.app.id}:${payload.toDate}:${payload.dropTenths}`,
      ),
    ];
  }

  if (payload.event === 'app.delisted') {
    return [
      appRow(payload, `delisted:${payload.app.id}:${payload.occurredAt}`),
    ];
  }

  if (payload.event === 'app.unlisted_market') {
    return [
      appRow(
        payload,
        `unlisted:${payload.app.id}:${payload.market}:${payload.occurredAt}`,
      ),
    ];
  }

  if (payload.event === 'review.spike') {
    return [appRow(payload, `review.spike:${payload.app.id}:${payload.date}`)];
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

  if (isChartMovePayload(payload)) {
    return [
      chartRow(
        payload,
        payload.event === 'chart.milestone' ? 'chart-milestone' : 'chart',
      ),
    ];
  }

  return [];
}
