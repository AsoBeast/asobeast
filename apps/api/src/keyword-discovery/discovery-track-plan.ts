import { DiscoverySource } from '@asobeast/shared';
import { planSeed } from '../apps/market-seed-plan';
import { TrackingLookup } from '../keywords/keyword-import-plan';

export interface TrackRow {
  keywordId: string;
  text: string;
  country: string;
  source: DiscoverySource;
  position: number | null;
  depth: number | null;
  resultCount: number | null;
  ownSearch: boolean;
  checkedOn: string | null;
}

export type TrackCandidate = Pick<TrackRow, 'keywordId' | 'text' | 'country'>;

export interface TrackPlan<T extends TrackCandidate> {
  chosen: T[];
  skipped: number;
}

function byCountry<T extends TrackCandidate>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(row.country, [...(grouped.get(row.country) ?? []), row]);
  }
  return grouped;
}

export function planDiscoveryTrack<T extends TrackCandidate>(
  rows: readonly T[],
  tracking: TrackingLookup,
  room: number | null,
): TrackPlan<T> {
  let remaining = room;
  const plan: TrackPlan<T> = { chosen: [], skipped: 0 };
  for (const [country, group] of byCountry(rows)) {
    const seeded = planSeed(group, tracking, country, remaining);
    plan.chosen.push(...seeded.chosen);
    plan.skipped += seeded.skipped;
    if (remaining !== null) remaining -= seeded.opened;
  }
  return plan;
}
