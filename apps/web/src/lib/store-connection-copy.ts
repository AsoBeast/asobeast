import type {
  Store,
  StoreConnectionApp,
  StoreConnectionItem,
  StoreReportState,
} from "@asobeast/shared";
import { formatDate, formatDateTime } from "./format";

export interface StatusLine {
  tone: "warning" | "muted";
  text: string;
}

export interface StoreConsoleCopy {
  name: string;
  connectLabel: string;
  replaceLabel: string;
  empty: string;
  noApps: string;
  appsLabel: string;
  verified: string;
  refused: string;
  waiting: string;
  disconnect: string;
  states: Record<StoreReportState, string>;
  facts: (item: StoreConnectionItem) => [string, string][];
}

const connectedOn = (item: StoreConnectionItem): [string, string] => [
  "Connected",
  formatDate(item.createdAt),
];

export const STORE_CONSOLES: Record<Store, StoreConsoleCopy> = {
  APP_STORE: {
    name: "App Store Connect",
    connectLabel: "Connect App Store Connect",
    replaceLabel: "Replace key",
    empty:
      "No store connected. Connect App Store Connect to see impressions, product page views, Get taps and conversion by market.",
    noApps: "Import an App Store app to read its numbers through this key.",
    appsLabel: "Apps this key reports",
    verified: "Key checked with Apple",
    refused:
      "App Store Connect refused this key. Verify it again, or connect a new key.",
    waiting:
      "Waiting for Apple's first report, usually within two days of connecting.",
    disconnect:
      "AsoBeast deletes the stored key and stops downloading reports. The numbers already stored are kept and appear again once you connect a key. Revoke the key in App Store Connect too if you no longer need it.",
    states: {
      requested: "Reporting",
      unmatched: "Not in this team",
      forbidden: "Needs an Admin key",
      stopped: "Stopped by Apple, verify to request again",
    },
    facts: (item) => [
      ["Issuer ID", item.issuerId],
      ["Key ID", item.keyId],
      ["Fingerprint", item.keyFingerprint],
      connectedOn(item),
    ],
  },
  GOOGLE_PLAY: {
    name: "Google Play Console",
    connectLabel: "Connect Google Play",
    replaceLabel: "Replace service account",
    empty:
      "Not connected. Connect the Google Play Console to see store listing visitors, acquisitions and conversion by market, and installs per search term.",
    noApps:
      "Import a Google Play app to read its numbers through this service account.",
    appsLabel: "Apps this service account reports",
    verified: "Service account checked with Google",
    refused:
      "Google refused this service account. Check its access in Play Console, verify it again, or connect a new one.",
    waiting:
      "Waiting for the first store performance file, which Google writes to the bucket once a day.",
    disconnect:
      "AsoBeast deletes the stored service account key and stops reading the bucket. The numbers already stored are kept and appear again once you connect a service account. Delete the key in Google Cloud too if you no longer need it.",
    states: {
      requested: "Reporting",
      unmatched: "No files in this bucket",
      forbidden: "No access to this app",
      stopped: "Stopped, verify to read again",
    },
    facts: (item) => [
      ["Service account", item.issuerId],
      ["Key ID", item.keyId],
      ["Bucket", item.bucket ?? "—"],
      ["Fingerprint", item.keyFingerprint],
      connectedOn(item),
    ],
  },
};

export function connectionStatusLine(item: StoreConnectionItem): StatusLine {
  const copy = STORE_CONSOLES[item.store];
  if (item.status === "rejected") {
    return { tone: "warning", text: item.lastError ?? copy.refused };
  }
  if (item.lastError) return { tone: "warning", text: item.lastError };
  if (!item.lastSyncedAt || item.apps.every((app) => app.lastDate === null)) {
    return { tone: "muted", text: copy.waiting };
  }
  return {
    tone: "muted",
    text: `Last synced ${formatDateTime(item.lastSyncedAt)}`,
  };
}

export const needsAdminKey = (item: StoreConnectionItem): boolean =>
  item.store === "APP_STORE" &&
  item.status !== "rejected" &&
  item.apps.some((app) => app.state === "forbidden");

export function appStateLabel(
  state: StoreReportState | null,
  store: Store = "APP_STORE",
): string {
  return state ? STORE_CONSOLES[store].states[state] : "Waiting";
}

export function historyLine(app: StoreConnectionApp): string {
  if (!app.firstDate || !app.lastDate) return "No data yet";
  return `Data from ${formatDate(app.firstDate)} to ${formatDate(app.lastDate)}`;
}
