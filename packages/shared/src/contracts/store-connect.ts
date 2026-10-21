import type { Store } from '../index';

export const STORE_CONNECTION_STATUSES = ['active', 'rejected'] as const;
export type StoreConnectionStatus = (typeof STORE_CONNECTION_STATUSES)[number];

export const STORE_REPORT_ACCESS = ['unknown', 'admin', 'readOnly'] as const;
export type StoreReportAccess = (typeof STORE_REPORT_ACCESS)[number];

export const STORE_REPLY_ACCESS = ['unknown', 'allowed', 'forbidden'] as const;
export type StoreReplyAccess = (typeof STORE_REPLY_ACCESS)[number];

export const STORE_REPORT_STATES = [
  'requested',
  'unmatched',
  'forbidden',
  'stopped',
] as const;
export type StoreReportState = (typeof STORE_REPORT_STATES)[number];

export interface StoreConnectionApp {
  appId: string;
  name: string | null;
  state: StoreReportState | null;
  firstDate: string | null;
  lastDate: string | null;
}

export interface StoreConnectionItem {
  store: Store;
  status: StoreConnectionStatus;
  reportAccess: StoreReportAccess;
  issuerId: string;
  keyId: string;
  keyFingerprint: string;
  createdAt: string;
  verifiedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  apps: StoreConnectionApp[];
  bucket?: string | null;
  replyAccess?: StoreReplyAccess;
}

export interface StoreConnectionState {
  available: boolean;
  connections: StoreConnectionItem[];
}

export interface AppStoreConnectionRequest {
  store: 'APP_STORE';
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export interface PlayConnectionRequest {
  store: 'GOOGLE_PLAY';
  serviceAccountJson: string;
  bucket: string;
}

export type StoreConnectionRequest =
  AppStoreConnectionRequest | PlayConnectionRequest;

export const STORE_CONNECTION_SYNC_OUTCOMES = ['queued', 'running'] as const;
export type StoreConnectionSyncOutcome =
  (typeof STORE_CONNECTION_SYNC_OUTCOMES)[number];

export interface StoreConnectionSyncResult {
  outcome: StoreConnectionSyncOutcome;
}
