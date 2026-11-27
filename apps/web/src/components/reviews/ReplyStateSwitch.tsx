"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { REVIEW_REPLY_STATES, type ReviewReplyState } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { literalOf } from "@/lib/literal";
import { reviewsOptions } from "@/lib/queries";
import { COUNT_OF } from "@/lib/review-reply-cache";
import { countsFilters, type ReviewView } from "./review-filters";
import { shownReplyStates } from "./reply-state";

const EVERY = "all";
const COUNT = "numeric text-muted-foreground";
const OPTION = "max-sm:flex-1 max-sm:px-1.5 max-[22.5rem]:h-7";

export function ReplyStateSwitch({
  id,
  view,
  onSelect,
}: {
  id: string;
  view: ReviewView;
  onSelect: (state: ReviewReplyState | null) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(reviewsOptions(id, countsFilters(view)));
  const counts = data.counts;
  if (!counts) return null;

  return (
    <Tabs
      activationMode="manual"
      className="max-sm:min-w-0 max-sm:flex-1"
      value={view.replyState ?? EVERY}
      onValueChange={(next) =>
        onSelect(literalOf(REVIEW_REPLY_STATES, next) ?? null)
      }
    >
      <TabsList
        aria-label={t("state.aria")}
        className="max-sm:w-full max-[22.5rem]:h-auto max-[22.5rem]:flex-wrap"
      >
        <TabsOption value={EVERY} className={OPTION}>
          <span>{t("state.all")}</span>
          <span className={COUNT}>
            {formatNumberInLocale(data.total, locale)}
          </span>
        </TabsOption>
        {shownReplyStates(counts, view.replyState, t).map(
          ({ value, short }) => (
            <TabsOption key={value} value={value} className={OPTION}>
              <span>{short}</span>
              <span className={COUNT}>
                {formatNumberInLocale(counts[COUNT_OF[value]], locale)}
              </span>
            </TabsOption>
          ),
        )}
      </TabsList>
    </Tabs>
  );
}
