import { normalizeText, SpiderStatus } from '@asobeast/shared';
import { SuggestItem } from '../store-providers/types';

export const SPIDER_PROBES: string[] = [
  '',
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
];

export const SPIDER_PROBES_TOTAL = SPIDER_PROBES.length;

const SUGGESTIONS_CAP = 100;

export interface SpiderProbeRow {
  probe: string;
  results: SuggestItem[];
}

export function spiderQuery(term: string, probe: string): string {
  return probe ? `${term} ${probe}` : term;
}

export function aggregateSpider(
  term: string,
  rows: SpiderProbeRow[],
  trackedTexts: Set<string>,
): SpiderStatus {
  const merged = new Map<string, { priority: number | null; probes: number }>();

  for (const row of rows) {
    const perRow = new Map<string, number | null>();
    for (const item of row.results) {
      const text = normalizeText(item.term);
      if (!text || trackedTexts.has(text)) {
        continue;
      }
      const priority = item.priority ?? null;
      const seen = perRow.get(text);
      if (seen === undefined || (priority ?? -1) > (seen ?? -1)) {
        perRow.set(text, priority);
      }
    }

    for (const [text, priority] of perRow) {
      const existing = merged.get(text);
      if (!existing) {
        merged.set(text, { priority, probes: 1 });
        continue;
      }
      existing.probes += 1;
      if ((priority ?? -1) > (existing.priority ?? -1)) {
        existing.priority = priority;
      }
    }
  }

  const suggestions = [...merged.entries()]
    .map(([text, { priority, probes }]) => ({ text, priority, probes }))
    .sort((a, b) => {
      const delta = (b.priority ?? -1) - (a.priority ?? -1);
      return delta !== 0 ? delta : b.probes - a.probes;
    })
    .slice(0, SUGGESTIONS_CAP);

  const probesDone = rows.length;
  return {
    term,
    probesDone,
    probesTotal: SPIDER_PROBES_TOTAL,
    complete: probesDone >= SPIDER_PROBES_TOTAL,
    suggestions,
  };
}
