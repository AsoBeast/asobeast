import { Store } from '@asobeast/shared';

export interface ChartCategory {
  store: Store;
  country: string;
  genre: string;
  device: string;
}

export const CHART_CATEGORY_COLUMNS = [
  'store',
  'country',
  'genre',
  'device',
] as const;

export function chartCategoryKey(category: ChartCategory): string {
  return `${category.store}~${category.country}~${category.genre}~${category.device}`;
}

export function oldestCategories<T extends ChartCategory>(
  rows: T[],
  limit: number | null,
): T[] {
  if (limit === null) return rows;
  const kept = new Set<string>();
  return rows.filter((row) => {
    const key = chartCategoryKey(row);
    if (kept.has(key)) return true;
    if (kept.size >= limit) return false;
    kept.add(key);
    return true;
  });
}
