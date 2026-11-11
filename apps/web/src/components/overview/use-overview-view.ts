"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { appSummaryOptions } from "@/lib/queries";
import { visibilityViewParser, type VisibilityView } from "@/lib/search-params";

export const OVERVIEW_VIEW_TITLES: Record<VisibilityView, string> = {
  visibility: "Search visibility",
  share: "Share of voice",
  top10: "Tracked keywords by rank band",
  rating: "Rating on the home listing",
};

const UNMEASURED_SHARE: ShareOfVoice = {
  current: null,
  delta7d: null,
  competitors: 0,
};

export function useOverviewView(id: string): {
  summary: AppSummary;
  share: ShareOfVoice;
  view: VisibilityView;
  select: (view: VisibilityView) => void;
} {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const [view, setView] = useQueryState("visView", visibilityViewParser);
  return {
    summary,
    share: summary.shareOfVoice ?? UNMEASURED_SHARE,
    view,
    select: (next) => void setView(next),
  };
}
