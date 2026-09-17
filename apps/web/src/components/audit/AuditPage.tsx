"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AiAnalysisPanel } from "@/components/audit/AiAnalysisPanel";
import { AuditActionPlan } from "@/components/audit/AuditActionPlan";
import { AuditFactorGrid } from "@/components/audit/AuditFactorGrid";
import { AuditLimitations } from "@/components/audit/AuditLimitations";
import { AuditTopFixes } from "@/components/audit/AuditTopFixes";
import { AuditHealthChart } from "@/components/audit/AuditHealthChart";
import { AuditScoreHero } from "@/components/audit/AuditScoreHero";
import { Skeleton } from "@/components/ui/skeleton";
import { auditOptions } from "@/lib/queries";

export function AuditPage({ appId }: { appId: string }) {
  const { data: audit } = useSuspenseQuery(auditOptions(appId));

  return (
    <div className="page-wide flex flex-col gap-8">
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <AuditScoreHero appId={appId} audit={audit} />
        </div>
        <div className="xl:col-span-7">
          <AuditTopFixes recommendations={audit.recommendations} />
        </div>
      </div>

      <AiAnalysisPanel appId={appId} audit={audit} />

      <AuditActionPlan appId={appId} audit={audit} />

      <AuditFactorGrid appId={appId} audit={audit} />

      <Suspense fallback={<Skeleton className="h-[336px] w-full rounded-xl" />}>
        <AuditHealthChart id={appId} />
      </Suspense>

      <AuditLimitations limitations={audit.limitations ?? []} />
    </div>
  );
}
