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

export const STORE_CREDENTIAL_KINDS = ['key', 'googleAccount'] as const;
export type StoreCredentialKind = (typeof STORE_CREDENTIAL_KINDS)[number];

export const PLAY_SIGN_IN_PATH = '/settings/google-play';

export const PLAY_REPLIES_NEED_KEY =
  'Posting replies to Google Play needs a service account key with the Reply to reviews permission. A Google sign in can only read reports.';

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
  credential?: StoreCredentialKind;
}

export interface StoreConnectionState {
  available: boolean;
  connections: StoreConnectionItem[];
  googleSignIn?: boolean;
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

export interface PlaySignInRequest {
  bucket: string;
}

export interface PlaySignInStart {
  url: string;
}

export interface PlaySignInCompletion {
  code: string;
  state: string;
}

export const STORE_CONNECTION_SYNC_OUTCOMES = ['queued', 'running'] as const;
export type StoreConnectionSyncOutcome =
  (typeof STORE_CONNECTION_SYNC_OUTCOMES)[number];

export interface StoreConnectionSyncResult {
  outcome: StoreConnectionSyncOutcome;
}
