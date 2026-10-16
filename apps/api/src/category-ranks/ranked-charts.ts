import { OVERALL_GENRE } from '@asobeast/shared';
import type { CategoryCollection } from '@asobeast/shared';

export interface ChartRef {
  collection: CategoryCollection;
  genre: string;
}

export interface RankedApp {
  collections: readonly CategoryCollection[];
  genre: string;
}

export const rankedChartKey = (chart: {
  collection: string;
  genre: string;
}): string => `${chart.collection}~${chart.genre}`;

export const rankedChartsOf = (app: RankedApp): ChartRef[] =>
  app.collections.flatMap((collection) =>
    [app.genre, OVERALL_GENRE].map((genre) => ({ collection, genre })),
  );

export const isRankedIn = (app: RankedApp, chart: ChartRef): boolean =>
  rankedChartsOf(app).some(
    (ranked) => rankedChartKey(ranked) === rankedChartKey(chart),
  );
