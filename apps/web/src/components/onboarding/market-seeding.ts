import type { MarketSeedResult, MarketSuggestion } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export type SeedOutcome =
  | { kind: "seeded"; seeded: number; skipped: number }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string };

export interface SeedPlan {
  select: string[];
  seed: string[];
}

export const defaultSeedChoice = (suggestion: MarketSuggestion): boolean =>
  suggestion.role === "default";

export const seedChosen = (
  suggestion: MarketSuggestion,
  choices: ReadonlyMap<string, boolean>,
): boolean => choices.get(suggestion.country) ?? defaultSeedChoice(suggestion);

export function withoutOutcomes(
  outcomes: Readonly<Record<string, SeedOutcome>>,
  markets: readonly string[],
): Record<string, SeedOutcome> {
  return Object.fromEntries(
    Object.entries(outcomes).filter(([market]) => !markets.includes(market)),
  );
}

export function seedButtonLabel(
  markets: number,
  seeds: number,
  t: MessageTranslator = english,
): string {
  if (markets === 0) return t("markets.addCountries");
  const add = t("markets.addCountriesCount", { count: markets });
  return seeds === 0 ? add : t("markets.addAndSeed", { add, count: seeds });
}

export function seedPlan(
  ticked: readonly string[],
  seeding: ReadonlySet<string>,
): SeedPlan {
  return {
    select: [...ticked],
    seed: ticked.filter((market) => seeding.has(market)),
  };
}

export function outcomeOf(result: MarketSeedResult): SeedOutcome {
  return result.status === "unavailable"
    ? { kind: "unavailable" }
    : { kind: "seeded", seeded: result.seeded, skipped: result.skipped };
}

export function outcomeText(
  outcome: SeedOutcome,
  t: MessageTranslator = english,
): string {
  if (outcome.kind === "failed") return outcome.message;
  if (outcome.kind === "unavailable") return t("markets.seedUnavailable");
  const skipped =
    outcome.skipped > 0
      ? t("markets.seedSkipped", { count: outcome.skipped })
      : "";
  if (outcome.seeded > 0) {
    return t("markets.seeded", { count: outcome.seeded, skipped });
  }
  return skipped
    ? t("markets.seededNone", { skipped })
    : t("markets.noNewKeywords");
}

export function seedStatusText(
  seeding: boolean,
  outcome: SeedOutcome | undefined,
  t: MessageTranslator = english,
): string | null {
  if (outcome) return outcomeText(outcome, t);
  return seeding ? t("markets.seeding") : null;
}
