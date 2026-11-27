"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatCountryInLocale } from "@/lib/format";
import { appDetailOptions } from "@/lib/queries";
import { rangeLabel, type DayPreset } from "@/lib/ranges";
import { useAppLocale } from "@/lib/use-app-locale";
import { usePrintedDate } from "./use-printed-date";

export interface ReportRange {
  label: string;
  preset: DayPreset;
}

export function ReportHeader({
  id,
  page,
  ranges,
}: {
  id: string;
  page: string;
  ranges: readonly ReportRange[];
}) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const printedDate = usePrintedDate();
  const t = useTranslations("appDetail");
  const tf = useTranslations("format");
  const locale = useAppLocale();
  const facts = [
    t("report.homeStorefront", {
      country: formatCountryInLocale(detail.country, locale),
    }),
    ...ranges.map((range) =>
      t("report.range", {
        label: range.label,
        range: rangeLabel(range.preset, tf),
      }),
    ),
  ];

  return (
    <div className="hidden flex-col gap-1 print:flex">
      <p className="text-heading">{t("report.title", { page })}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body text-muted-foreground">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p
        className="text-caption text-muted-foreground"
        suppressHydrationWarning
      >
        {t("report.printed", { date: printedDate, product: PRODUCT_NAME })}
      </p>
    </div>
  );
}
