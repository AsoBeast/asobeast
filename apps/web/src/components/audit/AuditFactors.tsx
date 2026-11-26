"use client";

import type { AppAuditResult } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import {
  LIST_HEAD,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { factorSections, type FactorSection } from "./factor-sections";
import { FACTOR_COLUMNS, FACTOR_WIDE_CELL, FactorRow } from "./FactorRow";
import { AUDIT_PAIR } from "./layout-classes";

function scoredCount(
  { factors }: FactorSection,
  t: ReturnType<typeof useTranslations>,
): string {
  const scored = factors.filter((factor) => factor.score !== null).length;
  return t("scoredCount", { scored, total: factors.length });
}

export function AuditFactors({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const t = useTranslations("audit");
  return (
    <div className={AUDIT_PAIR}>
      {factorSections(audit.factors, t).map((section) => (
        <section
          key={section.id}
          aria-labelledby={`factors-${section.id}`}
          className="min-w-0"
        >
          <Card className="@container/factors gap-0 pb-0">
            <CardHeader
              className={cn(PANEL_HEADER, "border-b border-border pb-3")}
            >
              <CardTitle asChild>
                <h2 id={`factors-${section.id}`}>{section.label}</h2>
              </CardTitle>
              <CardAction className={cn(PANEL_COUNT, "numeric")}>
                {scoredCount(section, t)}
              </CardAction>
            </CardHeader>
            <div
              aria-hidden
              className={cn(
                FACTOR_COLUMNS,
                LIST_HEAD,
                "h-9 border-b border-border whitespace-nowrap",
              )}
            >
              <span>{t("factor")}</span>
              <span>
                <span className={FACTOR_WIDE_CELL}>{t("status")}</span>
              </span>
              <span className={cn(FACTOR_WIDE_CELL, "text-right")}>
                {t("worth")}
              </span>
              <span className="text-right">{t("scoreOutOfTen")}</span>
              <span />
            </div>
            {section.factors.map((factor) => (
              <FactorRow
                key={factor.id}
                appId={appId}
                factor={factor}
                store={audit.store}
                totalWeight={audit.totalWeight}
              />
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
