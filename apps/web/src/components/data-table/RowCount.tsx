"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

const ROW_COUNT_KEYS = {
  keyword: "rowCountKeyword",
  app: "rowCountApp",
  action: "rowCountAction",
  row: "rowCountRow",
  event: "rowCountEvent",
} as const;

export function RowCount({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  const locale = useAppLocale();
  const t = useTranslations("ui");
  const key =
    ROW_COUNT_KEYS[noun as keyof typeof ROW_COUNT_KEYS] ?? "rowCountGeneric";
  const numberSpan = (chunks: ReactNode) => (
    <span className="numeric font-medium text-foreground">{chunks}</span>
  );
  const copy = t.rich(key, {
    shown: formatNumberInLocale(shown, locale),
    total: formatNumberInLocale(total, locale),
    count: total,
    shownValue: numberSpan,
    totalValue: numberSpan,
    noun: (chunks) => <span>{chunks}</span>,
  });

  return (
    <p className="text-body text-muted-foreground" aria-live="polite">
      {copy}
    </p>
  );
}
