import type { ActionItem, ActionPriorityCounts } from "@asobeast/shared";
import { formatCountry } from "@/lib/format";
import { appLabel } from "./queue-filters";

export interface WorkScopeRow {
  key: string;
  label: string;
  counts: ActionPriorityCounts;
  total: number;
}

function tally(
  items: readonly ActionItem[],
  keyOf: (item: ActionItem) => string,
  labelOf: (item: ActionItem) => string,
): WorkScopeRow[] {
  const rows = new Map<string, WorkScopeRow>();
  for (const item of items) {
    if (item.status !== "OPEN") continue;
    const key = keyOf(item);
    const row = rows.get(key) ?? {
      key,
      label: labelOf(item),
      counts: { critical: 0, high: 0, medium: 0, low: 0 },
      total: 0,
    };
    row.counts[item.priority] += 1;
    row.total += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (left, right) =>
      right.counts.critical - left.counts.critical ||
      right.counts.high - left.counts.high ||
      right.total - left.total ||
      left.label.localeCompare(right.label),
  );
}

export function workByApp(items: readonly ActionItem[]): WorkScopeRow[] {
  return tally(
    items,
    (item) => item.scope.appId,
    (item) => appLabel(item.scope),
  );
}

export function workByMarket(items: readonly ActionItem[]): WorkScopeRow[] {
  return tally(
    items,
    (item) => item.scope.country,
    (item) => formatCountry(item.scope.country),
  );
}
