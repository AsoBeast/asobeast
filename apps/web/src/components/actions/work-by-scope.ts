import type { ActionItem, ActionPriorityCounts } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatCountryInLocale } from "@/lib/format";
import { actionCategoryLabel } from "./action-copy";

export interface WorkScopeRow {
  key: string;
  label: string;
  name: string;
  detail: string | null;
  counts: ActionPriorityCounts;
  total: number;
}

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

function tally(
  items: readonly ActionItem[],
  keyOf: (item: ActionItem) => string,
  namesOf: (item: ActionItem) => Pick<WorkScopeRow, "name" | "detail">,
): WorkScopeRow[] {
  const rows = new Map<string, WorkScopeRow>();
  for (const item of items) {
    if (item.status !== "OPEN") continue;
    const key = keyOf(item);
    const names = namesOf(item);
    const row = rows.get(key) ?? {
      key,
      ...names,
      label: names.detail ? `${names.name} · ${names.detail}` : names.name,
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

export function workByApp(
  items: readonly ActionItem[],
  t: MessageTranslator = english,
): WorkScopeRow[] {
  return tally(
    items,
    (item) => item.scope.appId,
    (item) => ({
      name: item.scope.appName ?? t("unknownApp"),
      detail: item.scope.country.toUpperCase(),
    }),
  );
}

export function workByMarket(
  items: readonly ActionItem[],
  locale: Locale = "en",
): WorkScopeRow[] {
  return tally(
    items,
    (item) => item.scope.country,
    (item) => ({
      name: formatCountryInLocale(item.scope.country, locale),
      detail: null,
    }),
  );
}

export function workByCategory(
  items: readonly ActionItem[],
  t: MessageTranslator = english,
): WorkScopeRow[] {
  return tally(
    items,
    (item) => item.category,
    (item) => ({ name: actionCategoryLabel(item.category, t), detail: null }),
  );
}
