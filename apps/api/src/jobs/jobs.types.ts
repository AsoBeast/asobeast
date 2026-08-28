import {
  AlertPayload,
  CategoryCollection,
  FanOutSummary,
  Store,
} from '@asobeast/shared';
import { WorkspaceJobPayload } from './job-workspace';

export const QUEUES = {
  PIPELINE: 'pipeline',
  APP_STORE: 'appstore',
  GPLAY: 'gplay',
  ALERTS: 'alerts',
  BILLING: 'billing',
} as const;

export const FLOW_PRODUCERS = {
  ALERT_DELIVERY: 'alert-delivery',
  DAILY_PIPELINE: 'daily-pipeline',
} as const;

export const LAST_DAILY_RUN_KEY = 'asobeast:last-daily-run';

export const LAST_BACKUP_KEY = 'asobeast:last-backup';

export function actionsSuppressedKey(workspaceId: string): string {
  return `asobeast:actions-suppressed:${workspaceId}`;
}

export function queueNameForStore(store: Store): string {
  return store === 'GOOGLE_PLAY' ? QUEUES.GPLAY : QUEUES.APP_STORE;
}

export const JOBS = {
  DAILY: 'daily-pipeline',
  SCORING: 'weekly-scoring',
  RETENTION: 'data-retention',
  DIGEST: 'weekly-digest',
  AUDIT_SNAPSHOT: 'audit-snapshot',
  REFRESH_APP: 'refresh-app',
  CHECK_KEYWORD: 'check-keyword',
  CHECK_CATEGORY: 'check-category',
  SCORE_KEYWORD: 'score-keyword',
  SPIDER_PROBE: 'spider-probe',
  SYNC_REVIEWS: 'sync-reviews',
  DELIVER_ALERT: 'deliver-alert',
  DELIVER_EMAIL: 'deliver-email',
  DAILY_COMPLETE: 'daily-pipeline-complete',
  ACTIONS: 'generate-actions',
  PROXY_SYNC: 'proxy-pool-sync',
  BILLING_EVENT: 'billing-event',
  BILLING_RECONCILE: 'billing-reconcile',
  TRIAL_NOTICES: 'trial-notices',
} as const;

export interface BillingEventPayload {
  eventId: string;
}

export interface DailyCompletePayload extends FanOutSummary {
  date: string;
}

export interface RefreshAppPayload extends WorkspaceJobPayload {
  appId: string;
}

export interface DeliverAlertPayload extends WorkspaceJobPayload {
  webhookId: string;
  payload: AlertPayload;
}

export interface DeliverEmailPayload extends WorkspaceJobPayload {
  emailAlertId: string;
  payload: AlertPayload;
}

export interface CheckKeywordPayload extends WorkspaceJobPayload {
  keywordId: string;
}

export interface CheckCategoryPayload extends WorkspaceJobPayload {
  collection: CategoryCollection;
  genre: string;
  country: string;
  store: Store;
}

export interface ScoreKeywordPayload extends WorkspaceJobPayload {
  keywordId: string;
}

export interface SpiderProbePayload extends WorkspaceJobPayload {
  appId: string;
  term: string;
  country?: string;
  probe: string;
}

export interface SyncReviewsPayload extends WorkspaceJobPayload {
  appId: string;
  pages: number;
  backfill: boolean;
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyCompleteJobId(date: string): string {
  return `daily-complete~${date}`;
}

export function actionsJobId(workspaceId: string, date: string): string {
  return `actions~${workspaceId}~${date}`;
}

export function isoWeekKey(date = new Date()): string {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function scoreJobId(keywordId: string, bucket: string): string {
  return `score~${keywordId}~${bucket}`;
}

export function spiderJobId(
  appId: string,
  term: string,
  country: string,
  probe: string,
  date: string,
): string {
  const slug = `${term}~${country}~${probe || '_'}~${date}`.replace(/:/g, '-');
  return `spider~${appId}~${slug}`;
}

export function reviewsJobId(appId: string, date: string): string {
  return `reviews~${appId}~${date}`;
}

export function reviewsBackfillJobId(appId: string): string {
  return `reviews~${appId}~backfill`;
}

export function categoryJobId(
  workspaceId: string,
  collection: CategoryCollection,
  genre: string,
  country: string,
  date: string,
): string {
  return `category~${workspaceId}~${collection}~${genre}~${country}~${date}`;
}

export function checkJobId(keywordId: string, date: string): string {
  return `check~${keywordId}~${date}`;
}

export function firstRunCheckJobId(
  appId: string,
  keywordId: string,
  date: string,
): string {
  return `first-run~${appId}~${keywordId}~${date}`;
}
