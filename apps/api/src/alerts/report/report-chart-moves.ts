import { CHART_COLLECTION_TITLES, type ChartMoveScope } from '@asobeast/shared';

export const chartName = (chart: ChartMoveScope): string =>
  `${CHART_COLLECTION_TITLES[chart.collection]} · ${chart.genreName}`;

export const chartLabel = (chart: ChartMoveScope): string =>
  `${chartName(chart)} (${chart.country.toUpperCase()})`;
