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
  checkedOn: string | null;
}

export interface TrackPlan {
  chosen: TrackRow[];
  skipped: number;
}

function byCountry(rows: readonly TrackRow[]): Map<string, TrackRow[]> {
  const grouped = new Map<string, TrackRow[]>();
  for (const row of rows) {
    grouped.set(row.country, [...(grouped.get(row.country) ?? []), row]);
  }
  return grouped;
}

export function planDiscoveryTrack(
  rows: readonly TrackRow[],
  tracking: TrackingLookup,
  room: number | null,
): TrackPlan {
  let remaining = room;
  const plan: TrackPlan = { chosen: [], skipped: 0 };
  for (const [country, group] of byCountry(rows)) {
    const seeded = planSeed(group, tracking, country, remaining);
    plan.chosen.push(...seeded.chosen);
    plan.skipped += seeded.skipped;
    if (remaining !== null) remaining -= seeded.opened;
  }
  return plan;
}
