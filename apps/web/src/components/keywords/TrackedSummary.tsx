"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { utcDayOf } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { LEDE } from "@/components/layout/panel-classes";
import { keywordMoves, movesSentence } from "@/lib/keyword-day-change";
import { keywordCountriesOptions, keywordsOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";

const FIGURE = "numeric font-medium text-foreground";

export function TrackedSummary({ id, market }: { id: string; market: string }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const { data: keywords, dataUpdatedAt } = useSuspenseQuery(
    keywordsOptions(id, market),
  );
  const total = markets.reduce((sum, entry) => sum + entry.keywordCount, 0);
  const active = keywords.filter((keyword) => keyword.active).length;
  const moved = movesSentence(
    keywordMoves(keywords, utcDayOf(dataUpdatedAt)),
    t,
    locale,
  );
  const figure = (chunks: React.ReactNode) => (
    <span className={FIGURE}>{chunks}</span>
  );
  const tracking = t.rich(
    moved === null
      ? keywords.length === total
        ? "summary.trackingAll"
        : "summary.trackingOf"
      : keywords.length === total
        ? "summary.withMovedAll"
        : "summary.withMovedOf",
    {
      count: keywords.length,
      total,
      active,
      countValue: figure,
      totalValue: figure,
      activeValue: figure,
      ...(moved === null
        ? {}
        : {
            moved,
            movement: (chunks: React.ReactNode) => <span>{chunks}</span>,
          }),
    },
  );

  return (
    <p className={LEDE} aria-live="polite">
      <span>{tracking}</span>
    </p>
  );
}
