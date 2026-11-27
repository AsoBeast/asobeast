import type {
  ActionCategory,
  ActionPriority,
  ActionRule,
  Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatCountryInLocale, storeLabel } from "@/lib/format";
import {
  actionCategoryLabel,
  actionPriorityLabel,
  actionRuleLabel,
  actionStatusLabel,
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

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

function without<T>(values: readonly T[], value: T): T[] {
  return values.filter((entry) => entry !== value);
}

export function queueChips(
  view: QueueView,
  appLabels: ReadonlyMap<string, string>,
  t: MessageTranslator = english,
  locale: Locale = "en",
): QueueChip[] {
  const custom = presetOf(view.status) === null;
  return [
    ...(custom
      ? [
          {
            key: "status",
            label: `${t("statusLabel")}: ${view.status.map((status) => actionStatusLabel(status, t)).join(", ")}`,
            clear: { status: null },
          },
        ]
      : []),
    ...view.priority.map((priority) => ({
      key: `priority~${priority}`,
      label: actionPriorityLabel(priority, t),
      clear: { priority: without(view.priority, priority) },
    })),
    ...view.rule.map((rule) => ({
      key: `rule~${rule}`,
      label: actionRuleLabel(rule, t),
      clear: { rule: without(view.rule, rule) },
    })),
    ...view.category.map((category) => ({
      key: `category~${category}`,
      label: actionCategoryLabel(category, t),
      clear: { category: without(view.category, category) },
    })),
    ...view.app.map((app) => ({
      key: `app~${app}`,
      label: appLabels.get(app) ?? app,
      clear: { app: without(view.app, app) },
    })),
    ...view.market.map((market) => ({
      key: `market~${market}`,
      label: formatCountryInLocale(market, locale),
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
      ? [
          {
            key: "q",
            label: `${t("searchLabel")}: "${view.q.trim()}"`,
            clear: { q: null },
          },
        ]
      : []),
  ];
}
