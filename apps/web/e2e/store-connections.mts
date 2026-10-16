import type {
  StoreConnectionItem,
  StoreConnectionState,
} from "@asobeast/shared";

export const STORE_CONNECTION_COOKIE = "e2e_store_connection";
export const PLAY_CONNECTION_COOKIE = "e2e_play_connection";
export const STORE_CONNECT_OFF_COOKIE = "e2e_store_connect_off";

export const ADMIN_KEY_NEEDED =
  "This key can download reports but not request them. Connect an Admin key once; a Sales and Reports key can take over afterwards.";

export const STORE_CONNECTION_ACTIVE: StoreConnectionItem = {
  store: "APP_STORE",
  status: "active",
  reportAccess: "admin",
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  keyFingerprint: "3f9a2c7d41be0e85",
  createdAt: "2026-10-01T10:00:00.000Z",
  verifiedAt: "2026-10-01T10:00:00.000Z",
  lastSyncedAt: "2026-10-15T05:31:00.000Z",
  lastError: null,
  apps: [
    {
      appId: "app-1",
      name: "Focus Timer",
      state: "requested",
      firstDate: "2024-01-01",
      lastDate: "2026-10-12",
    },
    {
      appId: "app-2",
      name: "Habit Tracker",
      state: "unmatched",
      firstDate: null,
      lastDate: null,
    },
  ],
};

export const STORE_CONNECTION_REJECTED: StoreConnectionItem = {
  ...STORE_CONNECTION_ACTIVE,
  status: "rejected",
  lastError:
    "App Store Connect refused this key. Check the issuer ID and the key ID, and that the key is active.",
};

export const STORE_CONNECTION_READ_ONLY: StoreConnectionItem = {
  ...STORE_CONNECTION_ACTIVE,
  reportAccess: "readOnly",
  lastError: ADMIN_KEY_NEEDED,
  apps: STORE_CONNECTION_ACTIVE.apps.map((app) =>
    app.appId === "app-1" ? { ...app, state: "forbidden" } : app,
  ),
};

export const PLAY_BUCKET = "pubsite_prod_rev_01234567890987654321";

export const PLAY_CONNECTION_ACTIVE: StoreConnectionItem = {
  store: "GOOGLE_PLAY",
  status: "active",
  reportAccess: "admin",
  issuerId: "reports@focus-123.iam.gserviceaccount.com",
  keyId: "a1b2c3d4e5f6",
  keyFingerprint: "7c1e09ab53fd2468",
  createdAt: "2026-10-02T10:00:00.000Z",
  verifiedAt: "2026-10-02T10:00:00.000Z",
  lastSyncedAt: "2026-10-15T05:40:00.000Z",
  lastError: null,
  bucket: PLAY_BUCKET,
  apps: [
    {
      appId: "app-gp",
      name: "Tomato Clock",
      state: "requested",
      firstDate: "2026-09-01",
      lastDate: "2026-10-09",
    },
  ],
};

const CONNECTIONS: Record<string, StoreConnectionItem> = {
  active: STORE_CONNECTION_ACTIVE,
  rejected: STORE_CONNECTION_REJECTED,
  readOnly: STORE_CONNECTION_READ_ONLY,
};

export function storeConnectionOf(
  value: string | undefined,
): StoreConnectionItem | null {
  return value ? (CONNECTIONS[value] ?? null) : null;
}

export function storeConnectionState(
  value: string | undefined,
  off: boolean,
  play = false,
): StoreConnectionState {
  if (off) return { available: false, connections: [] };
  const connection = storeConnectionOf(value);
  return {
    available: true,
    connections: [
      ...(connection ? [connection] : []),
      ...(play ? [PLAY_CONNECTION_ACTIVE] : []),
    ],
  };
}

export const playConnectionCookie = (connected: boolean): string =>
  connected
    ? `${PLAY_CONNECTION_COOKIE}=active; Path=/`
    : `${PLAY_CONNECTION_COOKIE}=; Path=/; Max-Age=0`;

export const storeConnectionCookie = (value: string | null): string =>
  value === null
    ? `${STORE_CONNECTION_COOKIE}=; Path=/; Max-Age=0`
    : `${STORE_CONNECTION_COOKIE}=${value}; Path=/`;
