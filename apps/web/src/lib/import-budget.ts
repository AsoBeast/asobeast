import type {
  KeywordImportCost,
  Store,
  StoreDailyBudget,
} from "@asobeast/shared";
import { formatNumber, storeLabel } from "@/lib/format";

const WARN_AT = 0.85;
const FULL = 1;

export type BudgetTone = "info" | "warning" | "critical";

export interface BudgetNotice {
  tone: BudgetTone;
  text: string;
}

const SCORING =
  "Each new keyword is also scored once, which takes more requests over the next hours.";

export function importBudgetNotice(
  cost: KeywordImportCost,
  budget: StoreDailyBudget | null,
  showCapacity: boolean,
): BudgetNotice | null {
  if (cost.keywordMarkets === 0) return null;
  const added = `Adds about ${formatNumber(cost.dailyRequests)} store request${cost.dailyRequests === 1 ? "" : "s"} a day`;
  if (!showCapacity || budget === null || budget.capacityPerDay === 0) {
    return { tone: "info", text: `${added}. ${SCORING}` };
  }
  const after = (budget.total + cost.dailyRequests) / budget.capacityPerDay;
  const percent = Math.round(after * 100);
  const share = `${added}, taking ${storeLabel(cost.store)} to ${percent}% of its daily capacity`;
  if (after > FULL) {
    return {
      tone: "critical",
      text: `${share}, so the daily run will not finish within a day. Import fewer keywords or raise the store rate limit. ${SCORING}`,
    };
  }
  return {
    tone: after >= WARN_AT ? "warning" : "info",
    text: `${share}. ${SCORING}`,
  };
}

export function storeBudgetOf(
  stores: readonly StoreDailyBudget[],
  store: Store,
): StoreDailyBudget | null {
  return stores.find((entry) => entry.store === store) ?? null;
}
