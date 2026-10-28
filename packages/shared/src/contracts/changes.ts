import type { Store } from '../index';
import type { ReviewNegativePayload } from './reviews';
import type { DigestWeeklyPayload } from './portfolio';
import type { KeywordScope } from './keywords';
import type { SerpEntrantPayload } from './serp';
import type { ActionOpenedPayload } from './actions';
import type { ChartMovePayload } from './charts';
import type { RankMilestoneDirection, RankMilestoneTier } from '../rank';
import type { WebhookChannel } from '../webhook-channel';

export const CHANGE_FIELDS = [
  'title',
  'subtitle',
  'summary',
  'description',
  'version',
  'price',
  'screenshots',
  'screenshotImages',
  'screenshotCaptions',
  'icon',
  'whatsNew',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

export const CHANGE_FIELD_LABELS: Record<ChangeField, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  summary: 'Short description',
  description: 'Description',
  version: 'Version',
  price: 'Price',
  screenshots: 'Screenshots',
  screenshotImages: 'Screenshot images',
  screenshotCaptions: 'Screenshot captions',
  icon: 'Icon',
  whatsNew: "What's new",
};

export function isChangeField(value: string): value is ChangeField {
  return CHANGE_FIELDS.some((field) => field === value);
}

export interface ScreenshotRef {
  position: number;
  url: string;
}

export interface ScreenshotImagesDetail {
  kind: 'images';
  before: ScreenshotRef[];
  after: ScreenshotRef[];
  added: number[];
  removed: number[];
  reordered: boolean;
}

export interface ScreenshotCaptionsDetail {
  kind: 'captions';
  added: string[];
  removed: string[];
}

export type ChangeDetail = ScreenshotImagesDetail | ScreenshotCaptionsDetail;

export interface ChangeEventItem {
  id: string;
  appId: string;
  appName: string | null;
  isCompetitor: boolean;
  field: ChangeField;
  before: string | null;
  after: string | null;
  currency?: string | null;
  capturedAt: string;
  detail?: ChangeDetail | null;
  country?: string;
  localization?: string;
}

export interface ChangeTimeline {
  events: ChangeEventItem[];
}

export const WEBHOOK_EVENTS = [
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
  'chart.entered',
  'chart.left',
  'chart.milestone',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  hasSecret: boolean;
  createdAt: string;
  channel?: WebhookChannel;
  confirmDrops?: boolean;
}

export interface WebhookCreateRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  confirmDrops?: boolean;
}

export interface WebhookUpdateRequest {
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  active?: boolean;
  confirmDrops?: boolean;
}

export interface EmailAlertCreateRequest {
  email: string;
  events: WebhookEvent[];
  confirmDrops?: boolean;
}

export interface EmailAlertUpdateRequest {
  email?: string;
  events?: WebhookEvent[];
  active?: boolean;
  confirmDrops?: boolean;
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
  confirmed?: boolean;
  unsubscribed?: boolean;
  confirmationSent?: boolean;
  createdAt: string;
  confirmDrops?: boolean;
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
  app: {
    id: string;
    name: string | null;
    isCompetitor: boolean;
  } & AlertAppIdentity;
  changes: Array<{
    field: ChangeField;
    before: string | null;
    after: string | null;
  }>;
}

export interface RankDroppedPayload {
  event: 'rank.dropped';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  keyword: KeywordScope;
  from: number;
  to: number | null;
  fromDepth: number;
  toDepth: number;
  threshold: number;
  confirmed?: boolean;
}

export interface RankImprovedPayload {
  event: 'rank.improved';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  keyword: KeywordScope;
  from: number | null;
  to: number;
  fromDepth: number;
  toDepth: number;
  threshold: number;
  undoesDrop?: boolean;
}

export interface RankMilestonePayload {
  event: 'rank.milestone';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  keyword: KeywordScope;
  tier: RankMilestoneTier;
  direction: RankMilestoneDirection;
  from: number | null;
  to: number | null;
  fromDepth: number;
  toDepth: number;
  confirmed?: boolean;
  undoesDrop?: boolean;
}

export interface RankFirstPayload {
  event: 'rank.first';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  keyword: KeywordScope;
  position: number;
  depth: number;
}

export interface RankOvertakenPayload {
  event: 'rank.overtaken';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  keyword: KeywordScope;
  competitor: {
    id: string;
    name: string | null;
    from: number | null;
    to: number;
  };
  from: number;
  to: number | null;
  fromDepth: number;
  toDepth: number;
}

export interface AlertAppIdentity {
  iconUrl?: string | null;
  store?: Store;
  country?: string;
}

export interface AlertBatchApp extends AlertAppIdentity {
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
  rankMilestones: RankMilestonePayload[];
  firstRankings: RankFirstPayload[];
  overtakes: RankOvertakenPayload[];
  chartMoves?: ChartMovePayload[];
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
  | RankMilestonePayload
  | RankFirstPayload
  | RankOvertakenPayload
  | ReviewNegativePayload
  | DigestWeeklyPayload
  | SerpEntrantPayload
  | ActionOpenedPayload
  | ChartMovePayload;

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
