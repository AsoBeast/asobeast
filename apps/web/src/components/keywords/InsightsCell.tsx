"use client";

import { useId } from "react";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { keywordLabel, type TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROW_PEEK } from "./row-peek";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  insightDetail,
  insightLabel,
  insightsOf,
  shownInsights,
  type KeywordInsight,
} from "@/lib/keyword-insights";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const INSIGHT_VARIANTS: Record<
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
  t = english,
}: {
  keyword: TrackedKeywordItem;
  today: string;
  multiMarket: boolean;
  t?: MessageTranslator;
}) {
  const titleId = useId();
  const subjectId = useId();
  const insights = shownInsights(insightsOf(keyword, today));
  if (insights.length === 0) return null;
  const labels = insights.map((insight) => insightLabel(insight, t));
  const subject = multiMarket ? keywordLabel(keyword) : keyword.text;
  return (
    <span
      role="group"
      aria-label={t("insights.title")}
      className="flex items-center whitespace-nowrap"
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("insights.reasonsFor", {
              insights: labels.join(", "),
              subject,
            })}
            className={cn("inline-flex items-center gap-1", ROW_PEEK)}
          >
            {insights.map((insight, index) => (
              <Badge
                key={insight}
                variant={INSIGHT_VARIANTS[insight]}
                aria-hidden
                className={index > 0 ? "keywords-snug:hidden" : undefined}
              >
                {insightLabel(insight, t)}
              </Badge>
            ))}
            {insights.length > 1 ? (
              <span
                aria-hidden
                className="hidden text-caption text-muted-foreground keywords-snug:inline"
              >{`+${insights.length - 1}`}</span>
            ) : null}
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
            <PopoverTitle id={titleId}>{t("insights.title")}</PopoverTitle>
            <PopoverDescription id={subjectId} className="wrap-anywhere">
              {subject}
            </PopoverDescription>
          </PopoverHeader>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {insights.map((insight) => (
              <li key={insight}>
                <span className="font-medium text-foreground">
                  {insightLabel(insight, t)}
                </span>
                <span>{`: ${insightDetail(keyword, insight, t)}`}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
