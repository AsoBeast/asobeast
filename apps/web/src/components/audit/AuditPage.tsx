"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
  AuditRecommendation,
} from "@asobeast/shared";
import { AiAnalysisPanel } from "@/components/audit/AiAnalysisPanel";
import { AuditHealthChart } from "@/components/audit/AuditHealthChart";
import { AuditScoreHero } from "@/components/audit/AuditScoreHero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

function RecommendationList({
  title,
  items,
}: {
  title: string;
  items: AuditRecommendation[];
}) {
  return (
    <Card>
      <CardContent>
        <span className="text-label uppercase text-muted-foreground">
          {title}
        </span>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {items.slice(0, 5).map((item) => (
            <li key={`${item.factorId}-${item.checkId}`}>
              <span className="font-medium">{item.label}</span>
              <span className="block text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
      </div>

      <AiAnalysisPanel appId={appId} audit={audit} />

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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recommendations</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <RecommendationList
            title="Quick wins"
            items={audit.recommendations.quickWins}
          />
          <RecommendationList
            title="High impact"
            items={audit.recommendations.highImpact}
          />
          <RecommendationList
            title="Strategic"
            items={audit.recommendations.strategic}
          />
        </div>
      </section>

      <Suspense fallback={<Skeleton className="h-[336px] w-full rounded-xl" />}>
        <AuditHealthChart id={appId} />
      </Suspense>
    </div>
  );
}
