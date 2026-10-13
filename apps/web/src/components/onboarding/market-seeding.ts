import type { MarketSeedResult, MarketSuggestion } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

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

export function outcomeText(outcome: SeedOutcome): string {
  if (outcome.kind === "failed") return outcome.message;
  if (outcome.kind === "unavailable") {
    return "Not published on this storefront, so it was not added";
  }
  const skipped =
    outcome.skipped > 0
      ? `, ${outcome.skipped} left out by the keyword limit`
      : "";
  if (outcome.seeded > 0) {
    return `Seeded ${pluralize(outcome.seeded, "keyword")} from its listing${skipped}`;
  }
  return skipped
    ? `Seeded no keywords${skipped}`
    : "No new keywords in its listing";
}
