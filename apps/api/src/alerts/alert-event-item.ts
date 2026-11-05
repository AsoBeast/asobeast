import { Prisma } from '@prisma/client';
import {
  isAlertFeedEvent,
  type AlertEventItem,
  type GranularAlertPayload,
} from '@asobeast/shared';
import { sentenceOf } from './report/report-sentences';

export interface FeedRow {
  id: string;
  event: string;
  appId: string | null;
  keywordId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

export interface LiveApp {
  id: string;
  primaryAppId: string | null;
}

export interface HomeInput {
  row: Pick<FeedRow, 'appId' | 'keywordId'>;
  live: ReadonlyMap<string, LiveApp>;
  trackers: ReadonlyMap<string, readonly string[]>;
  preferred: string | null;
}

export const REMOVED_APP: unique symbol = Symbol('removed app');

export function eventMarket(payload: GranularAlertPayload): string | null {
  if ('chart' in payload) return payload.chart.country;
  if ('keyword' in payload && payload.keyword && 'country' in payload.keyword) {
    return payload.keyword.country;
  }
  if (payload.event === 'app.unlisted_market') return payload.market;
  if ('country' in payload && typeof payload.country === 'string') {
    return payload.country;
  }
  if ('app' in payload) return payload.app.country ?? null;
  return null;
}

function feedPayload(row: FeedRow): GranularAlertPayload | null {
  const { payload } = row;
  if (typeof payload !== 'object' || payload === null) return null;
  if (Array.isArray(payload)) return null;
  if (payload.event !== row.event) return null;
  return payload as unknown as GranularAlertPayload;
}

function buildItem(
  row: FeedRow,
  payload: GranularAlertPayload,
  primaryAppId: string | null,
): AlertEventItem | null {
  if (!isAlertFeedEvent(payload.event)) return null;
  const app = 'app' in payload ? payload.app : null;
  return {
    id: row.id,
    event: payload.event,
    occurredAt: row.createdAt.toISOString(),
    sentence: sentenceOf(payload, false).text,
    appId: row.appId ?? app?.id ?? null,
    appName: app?.name ?? null,
    iconUrl: app?.iconUrl ?? null,
    store: app?.store ?? null,
    country: eventMarket(payload),
    primaryAppId,
    payload,
  };
}

export function toAlertEventItem(
  row: FeedRow,
  primaryAppId: string | null,
): AlertEventItem | null {
  const payload = feedPayload(row);
  if (!payload) return null;
  try {
    return buildItem(row, payload, primaryAppId);
  } catch {
    return null;
  }
}

export function primaryAppOf(
  input: HomeInput,
): string | null | typeof REMOVED_APP {
  const { row, live, trackers, preferred } = input;
  if (row.appId) {
    const app = live.get(row.appId);
    if (!app) return REMOVED_APP;
    return app.primaryAppId ?? app.id;
  }
  if (!row.keywordId) return null;
  const tracking = trackers.get(row.keywordId) ?? [];
  if (preferred && tracking.includes(preferred)) return preferred;
  return tracking[0] ?? null;
}
