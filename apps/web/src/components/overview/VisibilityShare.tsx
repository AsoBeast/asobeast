"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RANK_DEPTH } from "@asobeast/shared";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { ShareCardDialog } from "@/components/charts/share-card/ShareCardDialog";
import { visibilityHeadline } from "@/lib/chart-image/share-card/headline";
import { appDetailOptions, visibilityOptions } from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

export function VisibilityShare({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { country } = useKeywordScope(id);
  const app = useCachedQueryData(appDetailOptions(id).queryKey);
  const { data } = useQuery({
    ...visibilityOptions(id, presetToRange(range), country),
    placeholderData: keepPreviousData,
  });
  const headline = useMemo(
    () => (data ? visibilityHeadline(data.points) : null),
    [data],
  );
  if (!app || !headline) return null;
  return (
    <ShareCardDialog
      subject="the visibility chart"
      source={{
        chart: "visibility-card",
        headline,
        kind: "visibility",
        depth: RANK_DEPTH,
        app,
      }}
    />
  );
}
