"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AppAuditResult } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, requestAiAuditRun } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { appKeys, invalidateAudit } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  AI_FEATURES_GUIDE,
  ANALYSIS_ACTION,
  ANALYSIS_COPY,
  analysisState,
} from "./analysis-state";

const ELAPSED_TICK_MS = 1_000;

const elapsedSeconds = (requestedAt: string | null): number =>
  requestedAt === null
    ? 0
    : Math.max(
        0,
        Math.round((Date.now() - new Date(requestedAt).getTime()) / 1000),
      );

function useElapsed(active: boolean, requestedAt: string | null): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () => setTick((value) => value + 1),
      ELAPSED_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [active]);

  return active ? elapsedSeconds(requestedAt) : 0;
}

function useRunTransitions(appId: string, audit: AppAuditResult): void {
  const queryClient = useQueryClient();
  const previous = useRef(audit.ai.run?.state ?? null);
  const overall = useRef(audit.overall);

  useEffect(() => {
    const state = audit.ai.run?.state ?? null;
    const was = previous.current;
    previous.current = state;
    const wasActive = was === "queued" || was === "running";
    if (!wasActive) {
      overall.current = audit.overall;
      return;
    }
    if (state === "completed") {
      toast.success("Creative analysis finished", {
        description: `Score ${overall.current ?? "—"} to ${audit.overall ?? "—"}`,
      });
      void invalidateAudit(queryClient, appId);
    }
    if (state === "failed") {
      toast.error("Creative analysis failed", {
        description: audit.ai.run?.error ?? undefined,
      });
    }
    overall.current = audit.overall;
  }, [
    appId,
    audit.ai.run?.state,
    audit.ai.run?.error,
    audit.overall,
    queryClient,
  ]);
}

export function AiAnalysisPanel({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useMutation({
    mutationKey: ["audit-ai-run", appId],
    mutationFn: () => requestAiAuditRun(appId),
    onSuccess: (result) => {
      if (result.reused) {
        toast.info("Already up to date", {
          description: "Your icon and screenshots have not changed.",
        });
        return;
      }
      queryClient.setQueryData(
        appKeys.audit(appId),
        (current?: AppAuditResult) =>
          current
            ? { ...current, ai: { ...current.ai, run: result } }
            : current,
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "The analysis could not be queued",
      );
    },
  });
  const analyzeOnce = useSingleFlight(mutation);
  const state = analysisState(audit, mutation.isPending);
  const active = state === "active";
  const elapsed = useElapsed(active, audit.ai.run?.requestedAt ?? null);
  const action = ANALYSIS_ACTION[state];
  const analyzed = audit.creative?.screenshots.length ?? 0;

  useRunTransitions(appId, audit);

  useEffect(() => {
    if (active) heading.current?.focus();
  }, [active]);

  return (
    <section id="ai-analysis" aria-labelledby="ai-analysis-heading">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2
                id="ai-analysis-heading"
                ref={heading}
                tabIndex={-1}
                className="flex items-center gap-2 text-body font-medium"
              >
                AI creative analysis
                {state === "current" ? (
                  <Badge variant="success">Up to date</Badge>
                ) : null}
                {state === "stale" ? (
                  <Badge variant="warning">Outdated</Badge>
                ) : null}
              </h2>
              <p className="text-sm text-muted-foreground">
                {state === "current" && audit.creative
                  ? `Analyzed ${formatDateTime(audit.creative.analyzedAt)} with ${audit.creative.model}`
                  : ANALYSIS_COPY[state]}
              </p>
              {state === "unconfigured" ? (
                <a
                  href={AI_FEATURES_GUIDE}
                  className="w-fit text-sm font-medium underline-offset-4 hover:underline"
                >
                  Read the AI features guide
                </a>
              ) : null}
              {state === "never" && audit.ai.model ? (
                <p className="text-caption text-muted-foreground">
                  Sends image links to OpenAI with {audit.ai.model}.
                </p>
              ) : null}
            </div>
            {action ? (
              <Button
                onClick={() => analyzeOnce()}
                disabled={mutation.isPending || state === "current"}
              >
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {action}
              </Button>
            ) : null}
          </div>

          {active ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2"
            >
              <span
                aria-hidden
                className="block h-1 w-full overflow-hidden rounded-full bg-muted"
              >
                <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </span>
              <span className="text-sm text-muted-foreground">
                Analyzing your icon and {analyzed} screenshots · {elapsed}s
              </span>
              <span className="text-sm text-muted-foreground">
                {ANALYSIS_COPY.active}
              </span>
            </div>
          ) : null}

          {state === "failed" ? (
            <Alert variant="destructive">
              <AlertTitle>{audit.ai.run?.error}</AlertTitle>
              <AlertDescription>{ANALYSIS_COPY.failed}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
