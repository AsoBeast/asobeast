import type {
  StoreConnectionItem,
  StoreConnectionState,
} from "@asobeast/shared";

export const STORE_CONNECTION_COOKIE = "e2e_store_connection";
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
): StoreConnectionState {
  if (off) return { available: false, connections: [] };
  const connection = storeConnectionOf(value);
  return { available: true, connections: connection ? [connection] : [] };
}

export const storeConnectionCookie = (value: string | null): string =>
  value === null
    ? `${STORE_CONNECTION_COOKIE}=; Path=/; Max-Age=0`
    : `${STORE_CONNECTION_COOKIE}=${value}; Path=/`;
