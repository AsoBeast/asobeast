import type { TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  INSIGHT_LABELS,
  insightDetail,
  insightsOf,
  shownInsights,
  type KeywordInsight,
} from "@/lib/keyword-insights";

const INSIGHT_VARIANTS: Record<
  KeywordInsight,
  "destructive" | "info" | "success" | "warning"
> = {
  dropping: "destructive",
  pageOneClose: "info",
  beatable: "success",
  notInListing: "warning",
};

export function InsightsCell({
  keyword,
  today,
}: {
  keyword: TrackedKeywordItem;
  today: string;
}) {
  const insights = shownInsights(insightsOf(keyword, today));
  if (insights.length === 0) return null;
  const details = insights.map(
    (insight) =>
      `${INSIGHT_LABELS[insight]}: ${insightDetail(keyword, insight)}`,
  );
  return (
    <span
      role="group"
      aria-label={`Insights. ${details.join(". ")}`}
      className="flex items-center gap-1 whitespace-nowrap"
    >
      {insights.map((insight) => (
        <Badge
          key={insight}
          variant={INSIGHT_VARIANTS[insight]}
          title={insightDetail(keyword, insight)}
          aria-hidden
        >
          {INSIGHT_LABELS[insight]}
        </Badge>
      ))}
    </span>
  );
}
