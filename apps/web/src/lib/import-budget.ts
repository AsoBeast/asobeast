import type {
  KeywordImportCost,
  Store,
  StoreDailyBudget,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enApps from "../../messages/en/apps.json";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";

const WARN_AT = 0.85;
const FULL = 1;

const english = createTranslator({
  locale: "en",
  namespace: "apps",
  messages: { apps: enApps },
});

export type BudgetTone = "info" | "warning" | "critical";

export interface BudgetNotice {
  tone: BudgetTone;
  text: string;
}

export function importBudgetNotice(
  cost: KeywordImportCost,
  budget: StoreDailyBudget | null,
  showCapacity: boolean,
  t: MessageTranslator = english,
): BudgetNotice | null {
  if (cost.keywordMarkets === 0) return null;
  const added = t("budget.added", { count: cost.dailyRequests });
  const scoring = t("budget.scoring");
  if (!showCapacity || budget === null || budget.capacityPerDay === 0) {
    return { tone: "info", text: t("budget.notice", { added, scoring }) };
  }
  const after = (budget.total + cost.dailyRequests) / budget.capacityPerDay;
  const percent = Math.round(after * 100);
  const share = t("budget.share", {
    added,
    store: storeLabel(cost.store),
    percent,
  });
  if (after > FULL) {
    return {
      tone: "critical",
      text: t("budget.overNotice", {
        share,
        over: t("budget.overCapacity"),
        scoring,
      }),
    };
  }
  return {
    tone: after >= WARN_AT ? "warning" : "info",
    text: t("budget.shareNotice", { share, scoring }),
  };
}

export function storeBudgetOf(
  stores: readonly StoreDailyBudget[],
  store: Store,
): StoreDailyBudget | null {
  return stores.find((entry) => entry.store === store) ?? null;
}
