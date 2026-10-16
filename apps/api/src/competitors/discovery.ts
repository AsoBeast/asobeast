import { CompetitorDiscoveryItem } from '@asobeast/shared';

export interface DiscoveryRow {
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  position: number;
  date: Date;
  country: string;
  keywordText: string;
}

interface DiscoveryGroup {
  latest: DiscoveryRow;
  iconRow: DiscoveryRow | null;
  appearances: number;
  positionSum: number;
  bestPosition: number;
  keywords: Set<string>;
}

const DISCOVERY_LIMIT = 20;
const KEYWORD_SAMPLE = 5;

function fresher(candidate: DiscoveryRow, current: DiscoveryRow): boolean {
  if (candidate.date.getTime() !== current.date.getTime()) {
    return candidate.date > current.date;
  }
  return candidate.country < current.country;
}

function outranks(
  candidate: DiscoveryRow,
  current: DiscoveryRow,
  homeCountry: string,
): boolean {
  const candidateAtHome = candidate.country === homeCountry;
  if (candidateAtHome !== (current.country === homeCountry)) {
    return candidateAtHome;
  }
  return fresher(candidate, current);
}

const newGroup = (row: DiscoveryRow): DiscoveryGroup => ({
  latest: row,
  iconRow: null,
  appearances: 0,
  positionSum: 0,
  bestPosition: row.position,
  keywords: new Set<string>(),
});

export function aggregateDiscovery(
  rows: DiscoveryRow[],
  homeCountry: string,
): CompetitorDiscoveryItem[] {
  const groups = new Map<string, DiscoveryGroup>();

  for (const row of rows) {
    const group = groups.get(row.storeAppId) ?? newGroup(row);
    groups.set(row.storeAppId, group);
    group.appearances += 1;
    group.positionSum += row.position;
    group.bestPosition = Math.min(group.bestPosition, row.position);
    group.keywords.add(row.keywordText);
    if (outranks(row, group.latest, homeCountry)) {
      group.latest = row;
    }
    if (row.iconUrl && (!group.iconRow || fresher(row, group.iconRow))) {
      group.iconRow = row;
    }
  }

  const items: CompetitorDiscoveryItem[] = [];
  for (const [storeAppId, group] of groups) {
    const keywords = [...group.keywords];
    items.push({
      storeAppId,
      title: group.latest.title,
      developer: group.latest.developer,
      iconUrl: group.latest.iconUrl ?? group.iconRow?.iconUrl ?? null,
      ratingAvg: group.latest.ratingAvg,
      ratingCount: group.latest.ratingCount,
      appearances: group.appearances,
      keywordCount: keywords.length,
      bestPosition: group.bestPosition,
      avgPosition:
        Math.round((group.positionSum / group.appearances) * 10) / 10,
      keywords: keywords.slice(0, KEYWORD_SAMPLE),
    });
  }

  items.sort(
    (a, b) => b.appearances - a.appearances || a.bestPosition - b.bestPosition,
  );
  return items.slice(0, DISCOVERY_LIMIT);
}
