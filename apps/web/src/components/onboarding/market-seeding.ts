import type { MarketSeedResult, MarketSuggestion } from "@asobeast/shared";
import { pluralize } from "@/lib/format";
import { localizationName } from "@/lib/localizations";

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

export function seedButtonLabel(markets: number, seeds: number): string {
  if (markets === 0) return "Add markets";
  const add = `Add ${pluralize(markets, "market")}`;
  return seeds === 0 ? add : `${add} and seed ${seeds}`;
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
  suggestion: MarketSuggestion,
  outcome: SeedOutcome,
): string {
  if (outcome.kind === "failed") return outcome.message;
  if (outcome.kind === "unavailable") {
    return "Not published on this storefront, so it was not added";
  }
  const skipped =
    outcome.skipped > 0
      ? `, ${outcome.skipped} left out by the keyword limit`
      : "";
  if (outcome.seeded > 0) {
    return `Seeded ${pluralize(outcome.seeded, "keyword")} from the ${localizationName(suggestion.localization)} listing${skipped}`;
  }
  return skipped ? `Seeded no keywords${skipped}` : "Already seeded";
}
