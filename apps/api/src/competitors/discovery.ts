import { CompetitorDiscoveryItem } from '@asobeast/shared';

export interface DiscoveryRow {
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  position: number;
  date: Date;
  keywordText: string;
}

const DISCOVERY_LIMIT = 20;
const KEYWORD_SAMPLE = 5;

export function aggregateDiscovery(
  rows: DiscoveryRow[],
): CompetitorDiscoveryItem[] {
  const groups = new Map<
    string,
    {
      latest: DiscoveryRow;
      appearances: number;
      positionSum: number;
      bestPosition: number;
      keywords: Set<string>;
    }
  >();

  for (const row of rows) {
    const group = groups.get(row.storeAppId);
    if (!group) {
      groups.set(row.storeAppId, {
        latest: row,
        appearances: 1,
        positionSum: row.position,
        bestPosition: row.position,
        keywords: new Set([row.keywordText]),
      });
      continue;
    }
    group.appearances += 1;
    group.positionSum += row.position;
    group.bestPosition = Math.min(group.bestPosition, row.position);
    group.keywords.add(row.keywordText);
    if (row.date > group.latest.date) {
      group.latest = row;
    }
  }

  const items: CompetitorDiscoveryItem[] = [];
  for (const [storeAppId, group] of groups) {
    const keywords = [...group.keywords];
    items.push({
      storeAppId,
      title: group.latest.title,
      developer: group.latest.developer,
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
