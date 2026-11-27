"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { useAppLocale } from "@/lib/use-app-locale";
import { staleCheckLabel, staleCheckLine } from "./stale-check";

export function StaleCheckMark({ day }: { day: string }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  return (
    <span
      data-slot="stale-check"
      title={staleCheckLine(day, t, locale)}
      className="inline-flex shrink-0 text-muted-foreground"
    >
      <History aria-hidden className="size-3.5" />
      <span className="sr-only">{staleCheckLabel(day, t, locale)}</span>
    </span>
  );
}
