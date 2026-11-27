"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { appSummaryOptions } from "@/lib/queries";
import { visibilityViewParser, type VisibilityView } from "@/lib/search-params";

const OVERVIEW_VIEW_KEYS: Record<VisibilityView, string> = {
  visibility: "views.searchVisibility",
  share: "views.shareOfVoice",
  top10: "views.rankBands",
  rating: "views.homeRating",
};

export function overviewViewTitle(
  view: VisibilityView,
  translator: MessageTranslator,
): string {
  return translator(OVERVIEW_VIEW_KEYS[view]);
}

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
