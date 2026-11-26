"use client";

import { useTranslations } from "next-intl";
import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/utils";
import { impactCaption } from "./action-copy";

export function ActionImpactMeter({
  impact,
  className = "w-24",
  compact = false,
}: {
  impact: number;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("actions");
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={t("impactMeter.aria")}
        aria-valuenow={impact}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={t("impactMeter.value", { impact })}
        title={impactCaption(t)}
        className={className}
      >
        <Meter value={impact} tone="opportunity" />
      </div>
      <span className="numeric text-caption text-muted-foreground">
        {impact}
        <span className="sr-only">{t("impactMeter.of100")}</span>
        <span className={cn(compact && "sr-only")}>
          {t("impactMeter.estimated")}
        </span>
      </span>
    </div>
  );
}
