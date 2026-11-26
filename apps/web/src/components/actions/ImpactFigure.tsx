"use client";

import { useTranslations } from "next-intl";
import { impactCaption } from "./action-copy";

export function ImpactFigure({
  impact,
  labelled = false,
  className,
}: {
  impact: number;
  labelled?: boolean;
  className?: string;
}) {
  const t = useTranslations("actions");
  return (
    <span title={impactCaption(t)} className={className}>
      {labelled ? (
        <span
          aria-hidden
          className="block text-right text-label text-faint-foreground"
        >
          {t("impact")}
        </span>
      ) : null}
      <span className="numeric block text-right text-dense font-medium">
        <span>{impact}</span>
        <span className="sr-only">{t("impactMeter.of100")}</span>
      </span>
    </span>
  );
}
