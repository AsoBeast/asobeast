"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type {
  AppAuditResult,
  AuditAiStatus,
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
  AuditRecommendation,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, runAiAudit } from "@/lib/api";
import { Meter } from "@/components/ui/meter";
import { formatRelativeTime } from "@/lib/format";

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

const SCORE_BANDS = [
  { min: 80, label: "Strong", variant: "success" },
  { min: 60, label: "Good", variant: "success" },
  { min: 40, label: "Fair", variant: "warning" },
  { min: 0, label: "Needs work", variant: "destructive" },
] as const satisfies readonly {
  min: number;
  label: string;
  variant: BadgeVariant;
}[];

function scoreBand(overall: number | null): {
  label: string;
  variant: BadgeVariant;
} {
  if (overall === null)
    return { label: "Not scored yet", variant: "secondary" };
  const band = SCORE_BANDS.find((entry) => overall >= entry.min);
  return band ?? { label: "Needs work", variant: "destructive" };
}

const STATUS_VARIANT: Record<AuditCheckStatus, BadgeVariant> = {
  pass: "success",
  warn: "warning",
  fail: "destructive",
  unanswered: "secondary",
};

const STATUS_LABEL: Record<AuditCheckStatus, string> = {
  pass: "pass",
  warn: "warn",
  fail: "fail",
  unanswered: "pending",
};

function FactorRow({ factor }: { factor: AuditFactorResult }) {
  const notApplicable = factor.weight === 0;
  return (
    <details className="rounded-xl border border-border">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          {factor.label}
          <span className="text-caption text-muted-foreground">
            weight {factor.weight}
          </span>
          {notApplicable ? (
            <Badge variant="outline">not applicable on this store</Badge>
          ) : null}
          {factor.needsInput ? (
            <Badge variant="secondary">pending</Badge>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          {notApplicable ? null : (
            <span className="hidden w-32 sm:block">
              <Meter
                value={factor.score === null ? 0 : factor.score}
                max={10}
                tone="health"
              />
            </span>
          )}
          <span className="numeric font-mono text-body">
            {notApplicable || factor.score === null
              ? "—"
              : `${factor.score}/10`}
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
            <span className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{check.kind}</Badge>
              <Badge variant={STATUS_VARIANT[check.status]}>
                {STATUS_LABEL[check.status]}
              </Badge>
            </span>
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
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing here — great work.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {items.slice(0, 5).map((item) => (
              <li key={`${item.factorId}-${item.checkId}`}>
                <span className="font-medium">{item.label}</span>
                <span className="block text-muted-foreground">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AiAuditCard({
  appId,
  ai,
  onResult,
}: {
  appId: string;
  ai: AuditAiStatus;
  onResult: (result: AppAuditResult) => void;
}) {
  const mutation = useMutation({
    mutationKey: ["audit-ai", appId],
    mutationFn: () => runAiAudit(appId),
    onSuccess: onResult,
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : "AI audit failed",
      );
    },
  });

  if (!ai.configured) {
    return (
      <Card>
        <CardContent>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI analysis
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code>OPENAI_API_KEY</code> to let AI review your screenshots,
            icon, preview video and conversion signals — no manual answers
            needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">AI analysis</span>
          <span className="text-xs text-muted-foreground">
            {ai.generatedAt
              ? `Last run ${formatRelativeTime(ai.generatedAt)}${
                  ai.model ? ` · ${ai.model}` : ""
                }`
              : "Scores the visual and conversion factors from your listing and creative."}
          </span>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {ai.generatedAt ? "Re-run AI audit" : "Run AI audit"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AuditView({
  appId,
  audit: initialAudit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const [audit, setAudit] = useState(initialAudit);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-2">
            <span className="text-label text-muted-foreground uppercase">
              ASO score
            </span>
            <div className="numeric font-mono text-4xl font-semibold">
              {audit.overall === null ? "—" : Math.round(audit.overall)}
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <Badge variant={scoreBand(audit.overall).variant}>
              {scoreBand(audit.overall).label}
            </Badge>
            <Meter value={audit.overall ?? 0} tone="health" className="w-32" />
          </CardContent>
        </Card>
        <p className="text-body text-muted-foreground">
          Automated coverage:{" "}
          <span className="numeric font-mono">{audit.coveredWeight}</span> of{" "}
          <span className="numeric font-mono">{audit.totalWeight}</span> weight
          scored. Unscored factors renormalize out of the overall, and
          zero-weight factors do not apply to this store.
        </p>
      </section>

      <AiAuditCard appId={appId} ai={audit.ai} onResult={setAudit} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Factors</h2>
        {audit.factors.map((factor) => (
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
    </div>
  );
}
