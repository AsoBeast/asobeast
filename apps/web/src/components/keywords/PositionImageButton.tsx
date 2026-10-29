"use client";

import type { RefObject } from "react";
import { Copy } from "lucide-react";
import type { Store, TrackedKeywordItem } from "@asobeast/shared";
import { useChartImage } from "@/components/charts/use-chart-image";
import type { RankingChartData } from "@/components/rankings/pivot";
import { rankingImageSpec } from "@/components/rankings/ranking-image";
import { Button } from "@/components/ui/button";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

export function PositionImageButton({
  appId,
  store,
  keyword,
  chart,
  chartRef,
}: {
  appId: string;
  store: Store;
  keyword: TrackedKeywordItem;
  chart: RankingChartData;
  chartRef: RefObject<HTMLDivElement | null>;
}) {
  const image = useChartImage();
  const detail = useCachedQueryData(appDetailOptions(appId).queryKey);

  const copy = () => {
    const container = chartRef.current;
    const spec = rankingImageSpec({
      chart,
      kind: "position-history",
      title: `Position history: ${keyword.text}`,
      app: {
        id: appId,
        name: detail?.name ?? null,
        storeAppId: detail?.storeAppId ?? appId,
        store,
      },
      countries: [keyword.country],
      keyword: keyword.text,
    });
    if (container && spec) image.copy({ container, ...spec });
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`Copy image of the position history of ${keyword.text}`}
      aria-disabled={image.pending || undefined}
      className="text-muted-foreground hover:text-foreground"
      onClick={copy}
    >
      <Copy aria-hidden />
    </Button>
  );
}
