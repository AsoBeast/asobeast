"use client";

import { useMemo } from "react";
import { Share2 } from "lucide-react";
import type { RankingSeriesItem, TrackedKeywordItem } from "@asobeast/shared";
import { ShareCardDialog } from "@/components/charts/share-card/ShareCardDialog";
import { Button } from "@/components/ui/button";
import { keywordHeadline } from "@/lib/chart-image/share-card/headline";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

export function PositionShareButton({
  appId,
  keyword,
  series,
  loading,
  onOpenChange,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  series: RankingSeriesItem | undefined;
  loading: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const app = useCachedQueryData(appDetailOptions(appId).queryKey);
  const headline = useMemo(
    () => (series ? keywordHeadline(series) : null),
    [series],
  );
  if (!app || !series || !headline) return null;
  const subject = `the position history of ${keyword.text}`;
  return (
    <ShareCardDialog
      subject={subject}
      source={{
        chart: "position-card",
        headline,
        kind: "rank",
        app,
        keyword: keyword.text,
      }}
      loading={loading}
      onOpenChange={onOpenChange}
      trigger={
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Share ${subject}`}
          className="text-muted-foreground hover:text-foreground print:hidden"
        >
          <Share2 aria-hidden />
        </Button>
      }
    />
  );
}
