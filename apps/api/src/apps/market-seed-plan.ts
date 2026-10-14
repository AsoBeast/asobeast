import { pairKey } from '../keywords/keyword-import';
import { TrackingLookup } from '../keywords/keyword-import-plan';

export interface SeedPhrase {
  text: string;
}

export interface SeedPlan<T extends SeedPhrase> {
  chosen: T[];
  opened: number;
  skipped: number;
}

export function planSeed<T extends SeedPhrase>(
  candidates: readonly T[],
  tracking: TrackingLookup,
  country: string,
  room: number | null,
): SeedPlan<T> {
  let remaining = room;
  const plan: SeedPlan<T> = { chosen: [], opened: 0, skipped: 0 };
  for (const candidate of candidates) {
    const state = tracking.get(pairKey(country, candidate.text));
    if (state?.own) continue;
    const opensMarket = !state?.elsewhere;
    if (opensMarket && remaining !== null) {
      if (remaining <= 0) {
        plan.skipped += 1;
        continue;
      }
      remaining -= 1;
    }
    plan.chosen.push(candidate);
    if (opensMarket) plan.opened += 1;
  }
  return plan;
}
