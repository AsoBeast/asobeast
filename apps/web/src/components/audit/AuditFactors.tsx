import type { AppAuditResult } from "@asobeast/shared";
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

function scoredCount({ factors }: FactorSection): string {
  const scored = factors.filter((factor) => factor.score !== null).length;
  return `${scored} of ${factors.length} scored`;
}

export function AuditFactors({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  return (
    <div className={AUDIT_PAIR}>
      {factorSections(audit.factors).map((section) => (
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
                {scoredCount(section)}
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
              <span>Factor</span>
              <span className={FACTOR_WIDE_CELL}>Status</span>
              <span className={cn(FACTOR_WIDE_CELL, "text-right")}>Worth</span>
              <span className="text-right">Score /10</span>
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
