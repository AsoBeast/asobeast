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

function statusOf(error: unknown): number | null {
  return error instanceof ApiError ? error.envelope.statusCode : null;
}

export function captureErrorText(error: unknown): string {
  const status = statusOf(error);
  if (status === 429 && error instanceof ApiError)
    return error.envelope.message;
  if (status === 502) return STORE_DID_NOT_ANSWER;
  return "Could not capture the chart.";
}

export function followErrorText(error: unknown): string {
  return statusOf(error) === 403 && error instanceof ApiError
    ? error.envelope.message
    : "Could not follow the chart.";
}
