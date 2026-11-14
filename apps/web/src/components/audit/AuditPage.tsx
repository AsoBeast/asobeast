"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AiAnalysisPanel } from "@/components/audit/AiAnalysisPanel";
import { AuditActionPlan } from "@/components/audit/AuditActionPlan";
import { AuditBenchmarks } from "@/components/audit/AuditBenchmarks";
import { AuditChecks } from "@/components/audit/AuditChecks";
import { AuditFactors } from "@/components/audit/AuditFactors";
import { AuditFooter } from "@/components/audit/AuditFooter";
import { AuditLede } from "@/components/audit/AuditLede";
import { AuditScorePanel } from "@/components/audit/AuditScorePanel";
import { AuditTopFixes } from "@/components/audit/AuditTopFixes";
import { CopyReportButton } from "@/components/audit/CopyReportButton";
import {
  AUDIT_GRID,
  AUDIT_MAIN,
  AUDIT_RAIL,
} from "@/components/audit/layout-classes";
import { PageHeader } from "@/components/layout/PageHeader";
import { appDetailOptions, auditOptions } from "@/lib/queries";

export function AuditPage({ appId }: { appId: string }) {
  const { data: audit } = useSuspenseQuery(auditOptions(appId));
  const { data: app } = useSuspenseQuery(appDetailOptions(appId));

  return (
    <div className="page-wide @container/audit flex flex-col gap-6">
      <PageHeader title="Audit" titleHidden>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <AuditLede audit={audit} />
          <CopyReportButton
            audit={audit}
            app={{ name: app.name, country: app.country }}
          />
        </div>
      </PageHeader>

      <div className={AUDIT_GRID}>
        <div className={AUDIT_MAIN}>
          <AuditScorePanel audit={audit} />
        </div>
        <div className={AUDIT_RAIL}>
          <AuditTopFixes
            appId={appId}
            recommendations={audit.recommendations}
          />
          <AuditChecks factors={audit.factors} />
        </div>
      </div>

      <AuditActionPlan appId={appId} audit={audit} />

      <AuditFactors appId={appId} audit={audit} />

      <AiAnalysisPanel appId={appId} audit={audit} />

      <AuditBenchmarks appId={appId} benchmarks={audit.benchmarks} />

      <AuditFooter audit={audit} />
    </div>
  );
}
