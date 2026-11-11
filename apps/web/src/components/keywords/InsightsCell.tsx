"use client";

import { useId } from "react";
import { keywordLabel, type TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  multiMarket,
}: {
  keyword: TrackedKeywordItem;
  today: string;
  multiMarket: boolean;
}) {
  const titleId = useId();
  const subjectId = useId();
  const insights = shownInsights(insightsOf(keyword, today));
  if (insights.length === 0) return null;
  const labels = insights.map((insight) => INSIGHT_LABELS[insight]);
  const subject = multiMarket ? keywordLabel(keyword) : keyword.text;
  return (
    <span
      role="group"
      aria-label="Insights"
      className="flex items-center whitespace-nowrap"
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${labels.join(", ")}: reasons for ${subject}`}
            className="-my-1 inline-flex items-center gap-1 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {insights.map((insight) => (
              <Badge
                key={insight}
                variant={INSIGHT_VARIANTS[insight]}
                aria-hidden
              >
                {INSIGHT_LABELS[insight]}
              </Badge>
            ))}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-labelledby={titleId}
          aria-describedby={subjectId}
          collisionPadding={16}
          className="w-80 max-w-(--radix-popover-content-available-width) text-body"
        >
          <PopoverHeader>
            <PopoverTitle id={titleId}>Insights</PopoverTitle>
            <PopoverDescription id={subjectId} className="wrap-anywhere">
              {subject}
            </PopoverDescription>
          </PopoverHeader>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {insights.map((insight) => (
              <li key={insight}>
                <span className="font-medium text-foreground">
                  {INSIGHT_LABELS[insight]}
                </span>
                <span>{`: ${insightDetail(keyword, insight)}`}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
