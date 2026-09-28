import type {
  ActionCategory,
  ActionItem,
  ActionPriority,
  ActionRule,
  ActionScope,
  ActionStatus,
  Store,
} from "@asobeast/shared";
import { formatCountry } from "@/lib/format";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";
import { matchesSearch } from "@/lib/search-text";
import { ACTION_RULE_TITLE } from "./action-copy";

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

export function appLabel(scope: ActionScope): string {
  return `${scope.appName ?? "Unknown app"} · ${scope.country.toUpperCase()}`;
}

function chosen(view: QueueView, key: FacetKey): readonly string[] {
  if (key === "store") return view.store ? [view.store] : [];
  return view[key];
}

function matchesFacet(item: ActionItem, view: QueueView, key: FacetKey) {
  const values = chosen(view, key);
  return values.length === 0 || values.includes(FACET_VALUE[key](item));
}

function matchesText(item: ActionItem, query: string): boolean {
  return matchesSearch(
    [
      ACTION_RULE_TITLE[item.rule],
      item.scope.keywordText ?? "",
      item.scope.appName ?? "",
      formatCountry(item.scope.country),
    ],
    query,
  );
}

export function filterQueue(
  items: readonly ActionItem[],
  view: QueueView,
): ActionItem[] {
  return items.filter(
    (item) =>
      FACETS.every((key) => matchesFacet(item, view, key)) &&
      matchesText(item, view.q),
  );
}

function countFacet(
  items: readonly ActionItem[],
  view: QueueView,
  key: FacetKey,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const others = FACETS.every(
      (other) => other === key || matchesFacet(item, view, other),
    );
    if (!others || !matchesText(item, view.q)) continue;
    const value = FACET_VALUE[key](item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function facetCounts(
  items: readonly ActionItem[],
  view: QueueView,
): QueueFacetCounts {
  return {
    priority: countFacet(items, view, "priority") as Map<
      ActionPriority,
      number
    >,
    rule: countFacet(items, view, "rule") as Map<ActionRule, number>,
    category: countFacet(items, view, "category") as Map<
      ActionCategory,
      number
    >,
    app: countFacet(items, view, "app"),
    market: countFacet(items, view, "market"),
    store: countFacet(items, view, "store") as Map<Store, number>,
  };
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
