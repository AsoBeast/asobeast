import type { TrackedKeywordItem } from "@asobeast/shared";

export interface HoldFact {
  label: string;
  value: string;
}

const count = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

export function positionHoldFacts(keyword: TrackedKeywordItem): HoldFact[] {
  const best = keyword.bestPosition ?? null;
  const delta = keyword.positionDeltaFromBest ?? null;
  const held = keyword.daysInTier ?? null;
  const tier = keyword.heldTier ?? null;

  const facts: HoldFact[] = [];
  if (best !== null) {
    facts.push({ label: "Best", value: `#${best}` });
  }
  if (delta !== null) {
    facts.push({
      label: "From best",
      value:
        delta === 0
          ? "At its best"
          : `${count(delta, "place", "places")} below`,
    });
  }
  if (held !== null && tier !== null) {
    facts.push({
      label: "Held",
      value: `Top ${tier} for ${count(held, "day", "days")}`,
    });
  }
  return facts;
}
