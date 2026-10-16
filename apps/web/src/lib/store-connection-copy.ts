import type {
  StoreConnectionApp,
  StoreConnectionItem,
  StoreReportState,
} from "@asobeast/shared";
import { formatDate, formatDateTime } from "./format";

export interface StatusLine {
  tone: "warning" | "muted";
  text: string;
}

const APP_STATE_LABELS: Record<StoreReportState, string> = {
  requested: "Reporting",
  unmatched: "Not in this team",
  forbidden: "Needs an Admin key",
  stopped: "Stopped by Apple, verify to request again",
};

export function connectionStatusLine(item: StoreConnectionItem): StatusLine {
  if (item.status === "rejected") {
    return {
      tone: "warning",
      text:
        item.lastError ??
        "App Store Connect refused this key. Verify it again, or connect a new key.",
    };
  }
  if (item.lastError) return { tone: "warning", text: item.lastError };
  if (!item.lastSyncedAt || item.apps.every((app) => app.lastDate === null)) {
    return {
      tone: "muted",
      text: "Waiting for Apple's first report, usually within two days of connecting.",
    };
  }
  return {
    tone: "muted",
    text: `Last synced ${formatDateTime(item.lastSyncedAt)}`,
  };
}

export function appStateLabel(state: StoreReportState | null): string {
  return state ? APP_STATE_LABELS[state] : "Waiting";
}

export function historyLine(app: StoreConnectionApp): string {
  if (!app.firstDate || !app.lastDate) return "No data yet";
  return `Data from ${formatDate(app.firstDate)} to ${formatDate(app.lastDate)}`;
}
