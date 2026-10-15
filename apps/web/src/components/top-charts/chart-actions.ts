import type {
  AppListItem,
  ChartAppLink,
  ChartAppRole,
  Store,
} from "@asobeast/shared";
import { ApiError } from "@/lib/api";

const STORE_DID_NOT_ANSWER = "The store did not answer. Try again in a moment.";

export function storeUrl(
  store: Store,
  storeAppId: string,
  country: string,
): string {
  return store === "APP_STORE"
    ? `https://apps.apple.com/${country}/app/id${storeAppId}`
    : `https://play.google.com/store/apps/details?id=${encodeURIComponent(storeAppId)}&gl=${country}`;
}

export interface RowLink {
  href: string;
  label: string;
  role: ChartAppRole;
}

export function rowLink(link: ChartAppLink | undefined): RowLink | null {
  if (!link) return null;
  if (link.role === "own") {
    return { href: `/apps/${link.appId}`, label: "Yours", role: "own" };
  }
  return {
    href: `/apps/${link.primaryAppId ?? link.appId}/competitors`,
    label: `Competitor of ${link.name ?? "your app"}`,
    role: "competitor",
  };
}

export function candidateApps(
  apps: readonly AppListItem[],
  store: Store,
): AppListItem[] {
  return apps.filter((app) => app.store === store);
}

export function captureErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return "Could not capture the chart.";
  const { statusCode, message } = error.envelope;
  if (statusCode === 429) return message;
  if (statusCode === 502) return STORE_DID_NOT_ANSWER;
  return "Could not capture the chart.";
}

export function followErrorText(error: unknown): string {
  return error instanceof ApiError && error.envelope.statusCode === 403
    ? error.envelope.message
    : "Could not follow the chart.";
}
