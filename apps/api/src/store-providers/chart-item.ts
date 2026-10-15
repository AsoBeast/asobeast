import { ChartItem } from './types';

export function toChartItem({
  storeAppId,
  title,
  ...listing
}: ChartItem): ChartItem {
  return {
    storeAppId,
    title,
    ...Object.fromEntries(
      Object.entries(listing).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    ),
  };
}
