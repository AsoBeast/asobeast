import type { Store } from "@asobeast/shared";
import { seriesDash } from "@/components/charts/theme";
import {
  buildChartCaption,
  type ChartCaption,
} from "@/lib/chart-image/caption";
import { chartImageFilename } from "@/lib/chart-image/filename";
import type { RankingChartData } from "./pivot";

export interface ImageApp {
  id: string;
  name: string | null;
  storeAppId: string;
  store: Store;
}

export interface RankingImageInput {
  chart: RankingChartData;
  kind: "rankings" | "position-history";
  title: string;
  app: ImageApp;
  countries: readonly string[];
  keyword?: string;
}

export interface RankingImageSpec {
  filename: string;
  caption: ChartCaption;
}

export function rankingImageSpec(
  input: RankingImageInput,
): RankingImageSpec | null {
  const { chart, app } = input;
  const first = chart.rows[0];
  const last = chart.rows.at(-1);
  if (first === undefined || last === undefined) return null;
  const from = String(first.date);
  const to = String(last.date);
  return {
    filename: chartImageFilename({
      chart: input.kind,
      appName: app.name,
      appId: app.id,
      keyword: input.keyword,
      from,
      to,
    }),
    caption: buildChartCaption({
      title: input.title,
      appName: app.name,
      storeAppId: app.storeAppId,
      store: app.store,
      countries: input.countries,
      from,
      to,
      series: chart.keywordIds.map((keywordId, index) => ({
        label: chart.seriesLabels[keywordId] ?? keywordId,
        color: `var(--color-${keywordId})`,
        dash: seriesDash(index),
      })),
    }),
  };
}
