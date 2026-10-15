import { ChartItem } from './types';

export function toChartItem(fields: ChartItem): ChartItem {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as ChartItem;
}
