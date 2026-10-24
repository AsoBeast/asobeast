import type {
  Store,
  StoreConnectionApp,
  StoreCredentialKind,
  StoreConnectionItem,
  StoreConnectionStatus,
  StoreReportAccess,
  StoreReportState,
} from '@asobeast/shared';
import { toDateKey } from '../analytics/analytics.support';

export interface ConnectionRow {
  store: Store;
  status: string;
  reportAccess: string;
  issuerId: string;
  keyId: string;
  keyFingerprint: string;
  createdAt: Date;
  verifiedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  bucket: string | null;
  credential: string;
}

export interface ConnectedAppRow {
  id: string;
  name: string | null;
  store: Store;
  storeReportRequests: { state: string }[];
}

export interface FunnelRangeRow {
  appId: string;
  _min: { date: Date | null };
  _max: { date: Date | null };
}

const dateOf = (date: Date | null | undefined): string | null =>
  date ? toDateKey(date) : null;

const isoOf = (date: Date | null): string | null =>
  date ? date.toISOString() : null;

function appsOf(
  store: Store,
  apps: ConnectedAppRow[],
  ranges: Map<string, FunnelRangeRow>,
): StoreConnectionApp[] {
  return apps
    .filter((app) => app.store === store)
    .map((app) => {
      const range = ranges.get(app.id);
      return {
        appId: app.id,
        name: app.name,
        state: (app.storeReportRequests[0]?.state ??
          null) as StoreReportState | null,
        firstDate: dateOf(range?._min.date),
        lastDate: dateOf(range?._max.date),
      };
    });
}

export function connectionItems(
  rows: ConnectionRow[],
  apps: ConnectedAppRow[],
  ranges: FunnelRangeRow[],
): StoreConnectionItem[] {
  const byApp = new Map(ranges.map((range) => [range.appId, range]));
  return rows.map((row) => ({
    store: row.store,
    status: row.status as StoreConnectionStatus,
    reportAccess: row.reportAccess as StoreReportAccess,
    issuerId: row.issuerId,
    keyId: row.keyId,
    keyFingerprint: row.keyFingerprint,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: isoOf(row.verifiedAt),
    lastSyncedAt: isoOf(row.lastSyncedAt),
    lastError: row.lastError,
    apps: appsOf(row.store, apps, byApp),
    credential: row.credential as StoreCredentialKind,
    ...(row.store === 'GOOGLE_PLAY' ? { bucket: row.bucket } : {}),
  }));
}
