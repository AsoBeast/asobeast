import type { Store } from '../index';
import type { ReviewNegativePayload } from './reviews';
import type { DigestWeeklyPayload } from './portfolio';
import type { KeywordScope } from './keywords';
import type { SerpEntrantPayload } from './serp';
import type { ActionOpenedPayload } from './actions';

export const CHANGE_FIELDS = [
  'title',
  'subtitle',
  'summary',
  'description',
  'version',
  'price',
  'screenshots',
  'icon',
  'whatsNew',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

export interface ChangeEventItem {
  id: string;
  appId: string;
  appName: string | null;
  isCompetitor: boolean;
  field: ChangeField;
  before: string | null;
  after: string | null;
  capturedAt: string;
}

export interface ChangeTimeline {
  events: ChangeEventItem[];
}

export const WEBHOOK_EVENTS = [
  'metadata.changed',
  'rank.dropped',
  'rank.improved',
  'review.negative',
  'digest.weekly',
  'serp.entrant',
  'action.opened',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  hasSecret: boolean;
  createdAt: string;
}

export interface WebhookCreateRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export interface WebhookUpdateRequest {
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  active?: boolean;
}

export interface EmailAlertCreateRequest {
  email: string;
  events: WebhookEvent[];
}

export interface EmailAlertUpdateRequest {
  email?: string;
  events?: WebhookEvent[];
  active?: boolean;
}

export interface WebhookTestResult {
  delivered: boolean;
  status: number | null;
}

export interface EmailAlertItem {
  id: string;
  email: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

export type AlertChannel = 'webhook' | 'email';
export type DeliveryStatus = 'success' | 'failed';

export interface AlertDeliveryItem {
  id: string;
  channel: AlertChannel;
  event: WebhookEvent;
  status: DeliveryStatus;
  detail: string | null;
  attempt: number;
  createdAt: string;
}

export interface AlertsConfig {
  emailEnabled: boolean;
}

export interface AlertFlushResult {
  flushed: number;
  channels: number;
  notifications: number;
}

export type AlertDeliveryMode = 'batched' | 'instant';

export interface AlertDeliveryStatus {
  mode: AlertDeliveryMode;
  pipelineCron: string;
  trigger: 'daily_pipeline_completion';
  lastFlushAt: string | null;
  pending: number;
  claimed: number;
}

export interface MetadataChangedPayload {
  event: 'metadata.changed';
  occurredAt: string;
  app: { id: string; name: string | null; isCompetitor: boolean };
  changes: Array<{
    field: ChangeField;
    before: string | null;
    after: string | null;
  }>;
}

export interface RankDroppedPayload {
  event: 'rank.dropped';
  occurredAt: string;
  app: { id: string; name: string | null };
  keyword: KeywordScope;
  from: number;
  to: number | null;
  fromDepth: number;
  toDepth: number;
  threshold: number;
}

export interface RankImprovedPayload {
  event: 'rank.improved';
  occurredAt: string;
  app: { id: string; name: string | null };
  keyword: KeywordScope;
  from: number | null;
  to: number;
  fromDepth: number;
  toDepth: number;
  threshold: number;
}

export interface AlertBatchApp {
  id: string;
  name: string | null;
  store: Store;
  country: string;
}

export interface AlertBatchCompetitorSection {
  app: AlertBatchApp;
  changes: MetadataChangedPayload[];
}

export interface AlertBatchAppSection {
  app: AlertBatchApp;
  rankDrops: RankDroppedPayload[];
  rankImprovements: RankImprovedPayload[];
  serpEntrants: SerpEntrantPayload[];
  changes: MetadataChangedPayload[];
  negativeReviews: ReviewNegativePayload[];
  actions: ActionOpenedPayload[];
  competitors: AlertBatchCompetitorSection[];
}

export type GranularAlertPayload =
  | MetadataChangedPayload
  | RankDroppedPayload
  | RankImprovedPayload
  | ReviewNegativePayload
  | DigestWeeklyPayload
  | SerpEntrantPayload
  | ActionOpenedPayload;

export type AlertBatchScope = 'owned_apps' | 'competitors';

export interface AlertBatchPayload {
  event: 'alerts.batch';
  scope: AlertBatchScope;
  occurredAt: string;
  window: { from: string; to: string };
  totals: { events: number; apps: number };
  apps: AlertBatchAppSection[];
  events: GranularAlertPayload[];
}

export type AlertPayload = GranularAlertPayload | AlertBatchPayload;
