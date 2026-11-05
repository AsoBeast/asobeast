import type { Store } from '../index';
import {
  WEBHOOK_EVENTS,
  type GranularAlertPayload,
  type WebhookEvent,
} from './changes';

export const ALERT_FEED_DAYS = 30;

export const ALERT_FEED_EXCLUDED_EVENTS = [
  'digest.weekly',
  'review.new',
] as const satisfies readonly WebhookEvent[];

export type AlertFeedEvent = Exclude<
  WebhookEvent,
  (typeof ALERT_FEED_EXCLUDED_EVENTS)[number]
>;

const excluded: readonly string[] = ALERT_FEED_EXCLUDED_EVENTS;

export function isAlertFeedEvent(value: string): value is AlertFeedEvent {
  return (
    WEBHOOK_EVENTS.some((event) => event === value) && !excluded.includes(value)
  );
}

export const ALERT_FEED_EVENTS: readonly AlertFeedEvent[] =
  WEBHOOK_EVENTS.filter(isAlertFeedEvent);

export interface AlertEventItem {
  id: string;
  event: AlertFeedEvent;
  occurredAt: string;
  sentence: string;
  appId: string | null;
  appName: string | null;
  iconUrl: string | null;
  store: Store | null;
  country: string | null;
  primaryAppId: string | null;
  payload: GranularAlertPayload;
}

export interface AlertEventList {
  events: AlertEventItem[];
  nextCursor: string | null;
}

export interface AlertEventQuery {
  appId?: string;
  type?: readonly AlertFeedEvent[];
  since?: string;
  cursor?: string;
  limit?: number;
}
