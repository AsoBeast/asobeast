"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChartKey } from "@asobeast/shared";
import { formatCountryInLocale, storeLabel } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

export function ChartPending({
  chart,
}: {
  chart: Pick<ChartKey, "store" | "country"> | null;
}) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {chart ? (
        <span className="flex animate-in items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-body text-popover-foreground shadow-overlay delay-300 duration-150 fade-in-0 fill-mode-backwards">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>
            {t("loading", {
              store: storeLabel(chart.store),
              country: formatCountryInLocale(chart.country, locale),
            })}
          </span>
        </span>
      ) : null}
    </div>
  );
}
