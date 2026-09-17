"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
} from "@asobeast/shared";
import { AiAnalysisPanel } from "@/components/audit/AiAnalysisPanel";
import { AuditActionPlan } from "@/components/audit/AuditActionPlan";
import { AuditTopFixes } from "@/components/audit/AuditTopFixes";
import { AuditHealthChart } from "@/components/audit/AuditHealthChart";
import { AuditScoreHero } from "@/components/audit/AuditScoreHero";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { auditOptions } from "@/lib/queries";
import { STATUS_LABEL } from "./audit-copy";

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

const STATUS_VARIANT: Record<AuditCheckStatus, BadgeVariant> = {
  pass: "success",
  warn: "warning",
  fail: "destructive",
  unanswered: "secondary",
};

function FactorRow({ factor }: { factor: AuditFactorResult }) {
  return (
    <details className="rounded-xl border border-border">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <span className="font-medium">{factor.label}</span>
        <span className="flex items-center gap-3">
          <span className="hidden w-32 sm:block">
            <Meter value={factor.score ?? 0} max={10} tone="health" />
          </span>
          <span className="numeric font-mono text-body">
            {factor.score === null ? "—" : `${factor.score}/10`}
          </span>
        </span>
      </summary>
      <ul className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
        {factor.checks.map((check: AuditCheckResult) => (
          <li
            key={check.id}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{check.label}</span>
              <span className="text-muted-foreground">{check.detail}</span>
            </span>
            <Badge variant={STATUS_VARIANT[check.status]}>
              {STATUS_LABEL[check.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </details>
  );
}

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

      <section aria-label="Search visibility" className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Search visibility</h2>
        {audit.factors
          .filter((factor) => factor.group !== "conversion")
          .map((factor) => (
            <FactorRow key={factor.id} factor={factor} />
          ))}
      </section>

      <section aria-label="Conversion" className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Conversion</h2>
        {audit.factors
          .filter((factor) => factor.group === "conversion")
          .map((factor) => (
            <FactorRow key={factor.id} factor={factor} />
          ))}
      </section>

      <Suspense fallback={<Skeleton className="h-[336px] w-full rounded-xl" />}>
        <AuditHealthChart id={appId} />
      </Suspense>
    </div>
  );
}
