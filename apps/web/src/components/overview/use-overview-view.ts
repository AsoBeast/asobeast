"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppSummary } from "@asobeast/shared";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { appSummaryOptions } from "@/lib/queries";
import { visibilityViewParser, type VisibilityView } from "@/lib/search-params";

export function useOverviewView(id: string): {
  summary: AppSummary;
  view: VisibilityView;
  select: (view: VisibilityView) => void;
} {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const [requested, setView] = useQueryState("visView", visibilityViewParser);
  return {
    summary,
    view:
      requested === "share" && !summary.shareOfVoice ? "visibility" : requested,
    select: (next) => void setView(next),
  };
}
