"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { RATING_CHANGE_RANGE } from "@/components/overview/rating-trend";
import { ratingsHistoryOptions, reviewsOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { useAppLocale } from "@/lib/use-app-locale";
import { reviewsLede } from "./review-lede";

export function ReviewsLede({ id }: { id: string }) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const { data: list, dataUpdatedAt } = useSuspenseQuery(
    reviewsOptions(id, {}),
  );
  const { data: history } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(RATING_CHANGE_RANGE)),
  );
  const parts = reviewsLede(
    {
      list,
      points: history.points,
      today: new Date(dataUpdatedAt).toISOString().slice(0, 10),
    },
    t,
    locale,
  );

  return (
    <PageHeader
      title={t("title")}
      titleHidden
      lede={parts.map((part, index) => (
        <span
          key={index}
          className={part.strong ? "font-medium text-foreground" : undefined}
        >
          {part.text}
        </span>
      ))}
    />
  );
}
