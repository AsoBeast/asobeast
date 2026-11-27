import type {
  ActionCategory,
  ActionItem,
  ActionPriority,
  ActionRule,
  ActionScope,
  ActionStatus,
  Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatCountryInLocale } from "@/lib/format";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";
import { matchesSearch } from "@/lib/search-text";
import { actionHeadline } from "./action-headline";

export interface QueueView {
  status: readonly ActionStatus[];
  priority: readonly ActionPriority[];
  rule: readonly ActionRule[];
  category: readonly ActionCategory[];
  app: readonly string[];
  market: readonly string[];
  store: Store | null;
  q: string;
}

export interface QueueFacetCounts {
  priority: ReadonlyMap<ActionPriority, number>;
  rule: ReadonlyMap<ActionRule, number>;
  category: ReadonlyMap<ActionCategory, number>;
  app: ReadonlyMap<string, number>;
  market: ReadonlyMap<string, number>;
  store: ReadonlyMap<Store, number>;
}

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

type FacetKey = keyof QueueFacetCounts;

const FACETS: readonly FacetKey[] = [
  "priority",
  "rule",
  "category",
  "app",
  "market",
  "store",
];

const FACET_VALUE: Record<FacetKey, (item: ActionItem) => string> = {
  priority: (item) => item.priority,
  rule: (item) => item.rule,
  category: (item) => item.category,
  app: (item) => item.scope.appId,
  market: (item) => item.scope.country,
  store: (item) => item.scope.store,
};

export function appLabel(
  scope: ActionScope,
  t: MessageTranslator = english,
): string {
  return `${scope.appName ?? t("unknownApp")} · ${scope.country.toUpperCase()}`;
}

function chosen(view: QueueView, key: FacetKey): readonly string[] {
  if (key === "store") return view.store ? [view.store] : [];
  return view[key];
}

function matchesFacet(item: ActionItem, view: QueueView, key: FacetKey) {
  const values = chosen(view, key);
  return values.length === 0 || values.includes(FACET_VALUE[key](item));
}

function matchesText(
  item: ActionItem,
  query: string,
  t: MessageTranslator,
  locale: Locale,
): boolean {
  return matchesSearch(
    [
      actionHeadline(item, t, locale),
      item.scope.keywordText ?? "",
      item.scope.appName ?? "",
      formatCountryInLocale(item.scope.country, locale),
    ],
    query,
  );
}

export function filterQueue(
  items: readonly ActionItem[],
  view: QueueView,
  t: MessageTranslator = english,
  locale: Locale = "en",
): ActionItem[] {
  return items.filter(
    (item) =>
      FACETS.every((key) => matchesFacet(item, view, key)) &&
      matchesText(item, view.q, t, locale),
  );
}

function countFacet(
  items: readonly ActionItem[],
  view: QueueView,
  key: FacetKey,
  { t, locale }: { t: MessageTranslator; locale: Locale },
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const others = FACETS.every(
      (other) => other === key || matchesFacet(item, view, other),
    );
    if (!others || !matchesText(item, view.q, t, locale)) continue;
    const value = FACET_VALUE[key](item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function facetCounts(
  items: readonly ActionItem[],
  view: QueueView,
  t: MessageTranslator = english,
  locale: Locale = "en",
): QueueFacetCounts {
  return {
    priority: countFacet(items, view, "priority", { t, locale }) as Map<
      ActionPriority,
      number
    >,
    rule: countFacet(items, view, "rule", { t, locale }) as Map<
      ActionRule,
      number
    >,
    category: countFacet(items, view, "category", { t, locale }) as Map<
      ActionCategory,
      number
    >,
    app: countFacet(items, view, "app", { t, locale }),
    market: countFacet(items, view, "market", { t, locale }),
    store: countFacet(items, view, "store", { t, locale }) as Map<
      Store,
      number
    >,
  };
}

export function leavesDefaultQueue(status: ActionStatus): boolean {
  return !ACTION_DEFAULT_STATUSES.some((value) => value === status);
}

export function isDefaultStatusSet(status: readonly ActionStatus[]): boolean {
  return (
    status.length === ACTION_DEFAULT_STATUSES.length &&
    ACTION_DEFAULT_STATUSES.every((value) => status.includes(value))
  );
}

export function isFilteredView(view: QueueView): boolean {
  return (
    !isDefaultStatusSet(view.status) ||
    FACETS.some((key) => chosen(view, key).length > 0) ||
    view.q.trim() !== ""
  );
}
