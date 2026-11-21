import {
  STORES,
  type PortfolioApp,
  type PortfolioAppInsight,
  type PortfolioHistory,
  type PortfolioHistoryScope,
  type PortfolioPartChange,
  type Store,
} from "@asobeast/shared";
import { pluralize, storeLabel, storeShortLabel } from "@/lib/format";
import type { DashboardBreakdown, DashboardMetric } from "@/lib/search-params";

export const BREAKDOWN_LIMIT = 6;

export const BREAKDOWN_MORE_ID = "breakdown-more";

export const breakdownRowId = (id: string): string => `breakdown-${id}`;

export interface BreakdownRow {
  id: string;
  name: string;
  mark: string;
  shortMark: string;
  iconUrl?: string | null;
  change: PortfolioPartChange;
  open: number;
  critical: number;
}

const isStore = (value: string): value is Store =>
  STORES.some((store) => store === value);

const checkedApps = (apps: readonly PortfolioApp[]): PortfolioApp[] =>
  apps.filter((app) => app.lastCapturedAt !== null);

const storesOf = (apps: readonly PortfolioApp[]): Set<Store> =>
  new Set(checkedApps(apps).map((app) => app.store));

export const hasSeveralStores = (apps: readonly PortfolioApp[]): boolean =>
  storesOf(apps).size > 1;

export const breakdownBy = (
  by: DashboardBreakdown,
  apps: readonly PortfolioApp[],
): DashboardBreakdown => (hasSeveralStores(apps) ? by : "app");

export function historyScope(
  by: DashboardBreakdown,
  scope: string | null,
  apps: readonly PortfolioApp[],
): PortfolioHistoryScope {
  if (scope === null) return {};
  if (breakdownBy(by, apps) === "store") {
    return isStore(scope) && storesOf(apps).has(scope) ? { store: scope } : {};
  }
  return apps.some((app) => app.id === scope) ? { appId: scope } : {};
}

export const scopeId = (scope: PortfolioHistoryScope): string | null =>
  scope.appId ?? scope.store ?? null;

export function appLabel(
  app: PortfolioApp,
  apps: readonly PortfolioApp[],
): string {
  const name = app.name ?? "Untitled app";
  const shared = apps.some(
    (other) => other.id !== app.id && other.name === app.name,
  );
  return shared ? `${name} (${app.country.toUpperCase()})` : name;
}

function actionsOf(
  apps: readonly PortfolioApp[],
  insights: ReadonlyMap<string, PortfolioAppInsight>,
): Pick<BreakdownRow, "open" | "critical"> {
  const counts = apps.flatMap((app) => insights.get(app.id)?.actions ?? []);
  return {
    open: counts.reduce((total, each) => total + each.open, 0),
    critical: counts.reduce((total, each) => total + each.critical, 0),
  };
}

export function breakdownRows(
  history: PortfolioHistory,
  apps: readonly PortfolioApp[],
  insights: ReadonlyMap<string, PortfolioAppInsight>,
  by: DashboardBreakdown,
): BreakdownRow[] {
  if (by === "store") {
    return (history.stores ?? []).map((part) => ({
      id: part.store,
      name: storeLabel(part.store),
      mark: pluralize(part.apps, "app"),
      shortMark: pluralize(part.apps, "app"),
      change: part.change,
      ...actionsOf(
        apps.filter((app) => app.store === part.store),
        insights,
      ),
    }));
  }
  return (history.apps ?? []).flatMap((part) => {
    const app = apps.find((each) => each.id === part.appId);
    if (!app) return [];
    return [
      {
        id: app.id,
        name: app.name ?? "Untitled app",
        mark: `${storeLabel(app.store)} · ${app.country.toUpperCase()}`,
        shortMark: `${storeShortLabel(app.store)} · ${app.country.toUpperCase()}`,
        iconUrl: app.iconUrl,
        change: part.change,
        ...actionsOf([app], insights),
      },
    ];
  });
}

const signed = (value: number): string =>
  value > 0 ? `+${value}` : String(value);

function figuresOf(
  row: BreakdownRow,
  metric: DashboardMetric,
  unit: string,
): string {
  if (metric === "moved") {
    const { up, down } = row.change.movement;
    return `${up} climbing, ${down} falling`;
  }
  if (metric === "actions") {
    return row.critical > 0
      ? `${row.open} open, ${row.critical} critical`
      : `${row.open} open`;
  }
  const [now, delta] =
    metric === "visibility"
      ? [Math.round(row.change.visibility), row.change.visibilityDelta]
      : [row.change.top10, row.change.top10Delta];
  return delta === null
    ? `${now} now, no ${unit} data`
    : `${now} now, ${signed(Math.round(delta))} ${unit}`;
}

const spokenMark = (row: BreakdownRow): string =>
  row.shortMark === row.mark ? row.mark : `${row.shortMark}, ${row.mark}`;

export const rowLabel = (
  row: BreakdownRow,
  metric: DashboardMetric,
  unit: string,
): string => `${row.name} ${spokenMark(row)}, ${figuresOf(row, metric, unit)}`;

export const BREAKDOWN_MIN_APPS = 2;

export function breakdownSize(apps: readonly PortfolioApp[]): number {
  const checked = checkedApps(apps).length;
  if (checked < BREAKDOWN_MIN_APPS) return 0;
  return checked <= BREAKDOWN_LIMIT + 1 ? checked : BREAKDOWN_LIMIT;
}

export const isBrokenDown = (history: PortfolioHistory): boolean =>
  (history.apps ?? []).length >= BREAKDOWN_MIN_APPS;

export function rowSize(row: BreakdownRow, metric: DashboardMetric): number {
  if (metric === "visibility") return Math.abs(row.change.visibilityDelta ?? 0);
  if (metric === "top10") return Math.abs(row.change.top10Delta ?? 0);
  if (metric === "moved") {
    return row.change.movement.up + row.change.movement.down;
  }
  return row.open;
}

export function sortRows(
  rows: readonly BreakdownRow[],
  metric: DashboardMetric,
): BreakdownRow[] {
  const urgency = (row: BreakdownRow) =>
    metric === "actions" ? row.critical : 0;
  return [...rows].sort(
    (a, b) =>
      urgency(b) - urgency(a) ||
      rowSize(b, metric) - rowSize(a, metric) ||
      a.name.localeCompare(b.name) ||
      a.mark.localeCompare(b.mark),
  );
}

const isCut = (sorted: readonly BreakdownRow[]): boolean =>
  sorted.length > BREAKDOWN_LIMIT + 1;

export function shownRows(
  sorted: readonly BreakdownRow[],
  pinned: string | null,
): BreakdownRow[] {
  if (!isCut(sorted)) return [...sorted];
  return sorted.filter(
    (row, index) => index < BREAKDOWN_LIMIT || row.id === pinned,
  );
}

export const leavesWithScope = (
  sorted: readonly BreakdownRow[],
  id: string,
): boolean =>
  isCut(sorted) && sorted.findIndex((row) => row.id === id) >= BREAKDOWN_LIMIT;
