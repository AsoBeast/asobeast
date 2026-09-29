import type {
  ActionCategory,
  ActionPriority,
  ActionRule,
  Store,
} from "@asobeast/shared";
import { formatCountry, storeLabel } from "@/lib/format";
import {
  ACTION_CATEGORY_LABEL,
  ACTION_PRIORITY_LABEL,
  ACTION_RULE_LABEL,
  ACTION_STATUS_LABEL,
} from "./action-copy";
import type { QueueView } from "./queue-filters";
import { presetOf } from "./status-presets";

export interface QueueChip {
  key: string;
  label: string;
  clear: {
    status?: null;
    priority?: ActionPriority[];
    rule?: ActionRule[];
    category?: ActionCategory[];
    app?: string[];
    market?: string[];
    store?: Store | null;
    q?: string | null;
  };
}

function without<T>(values: readonly T[], value: T): T[] {
  return values.filter((entry) => entry !== value);
}

export function queueChips(
  view: QueueView,
  appLabels: ReadonlyMap<string, string>,
): QueueChip[] {
  const custom = presetOf(view.status) === null;
  return [
    ...(custom
      ? [
          {
            key: "status",
            label: `Status: ${view.status.map((status) => ACTION_STATUS_LABEL[status]).join(", ")}`,
            clear: { status: null },
          },
        ]
      : []),
    ...view.priority.map((priority) => ({
      key: `priority~${priority}`,
      label: ACTION_PRIORITY_LABEL[priority],
      clear: { priority: without(view.priority, priority) },
    })),
    ...view.rule.map((rule) => ({
      key: `rule~${rule}`,
      label: ACTION_RULE_LABEL[rule],
      clear: { rule: without(view.rule, rule) },
    })),
    ...view.category.map((category) => ({
      key: `category~${category}`,
      label: ACTION_CATEGORY_LABEL[category],
      clear: { category: without(view.category, category) },
    })),
    ...view.app.map((app) => ({
      key: `app~${app}`,
      label: appLabels.get(app) ?? app,
      clear: { app: without(view.app, app) },
    })),
    ...view.market.map((market) => ({
      key: `market~${market}`,
      label: formatCountry(market),
      clear: { market: without(view.market, market) },
    })),
    ...(view.store
      ? [
          {
            key: "store",
            label: storeLabel(view.store),
            clear: { store: null },
          },
        ]
      : []),
    ...(view.q.trim() !== ""
      ? [{ key: "q", label: `Search: "${view.q.trim()}"`, clear: { q: null } }]
      : []),
  ];
}
