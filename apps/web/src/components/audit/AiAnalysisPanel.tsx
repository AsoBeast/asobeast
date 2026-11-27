"use client";

import type { RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AppAuditResult } from "@asobeast/shared";
import {
  AiCallsLeft,
  useAiAllowanceSpent,
  useAiFailureToast,
} from "@/components/ai/ai-allowance";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestAiAuditRun } from "@/lib/api";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { appKeys, invalidateAiUsage } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";
import {
  AI_FEATURES_GUIDE,
  analysisAction,
  analysisCopy,
  analysisState,
  type AnalysisState,
  creativeSentLine,
  progressLine,
  sendsCreative,
} from "./analysis-state";
import { CreativeObservations } from "./CreativeObservations";
import { TEXT_LINK } from "./layout-classes";
import {
  useElapsed,
  useFocusWhenQueued,
  useRunTransitions,
} from "./use-analysis-run";

const STATE_MARK = "inline-flex items-center gap-1.5 text-caption";

function StateMark({ state }: { state: AnalysisState }) {
  const t = useTranslations("audit");
  if (state === "current") {
    return (
      <span className={cn(STATE_MARK, "text-muted-foreground")}>
        <span aria-hidden className="size-2 rounded-full bg-foreground" />
        <span>{t("analysis.upToDate")}</span>
      </span>
    );
  }
  if (state === "stale") {
    return (
      <span className={cn(STATE_MARK, "font-medium text-warning")}>
        {t("outdated")}
      </span>
    );
  }
  return null;
}

function RunProgress({
  active,
  analyzed,
  requestedAt,
}: {
  active: boolean;
  analyzed: number | null;
  requestedAt: string | null;
}) {
  const t = useTranslations("audit");
  const elapsed = useElapsed(active, requestedAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex max-w-[70ch] flex-col gap-2 empty:hidden"
    >
      {active ? (
        <>
          <span
            aria-hidden
            className="block h-1 w-full overflow-hidden rounded-full bg-muted"
          >
            <span className="block h-full w-1/3 rounded-full bg-foreground motion-safe:animate-pulse" />
          </span>
          <span className="text-dense text-muted-foreground">
            <span>{progressLine(analyzed, t)}</span>
            {elapsed === null ? null : (
              <span aria-hidden>{` · ${elapsed}s`}</span>
            )}
          </span>
        </>
      ) : null}
    </div>
  );
}

function AnalysisIntro({
  state,
  audit,
}: {
  state: AnalysisState;
  audit: AppAuditResult;
}) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  return (
    <div className="flex max-w-[70ch] flex-col gap-1">
      <p className="text-dense text-muted-foreground">
        {state === "current" && audit.creative
          ? t("analyzed", {
              date: formatDateTimeInLocale(audit.creative.analyzedAt, locale),
              model: audit.creative.model,
            })
          : analysisCopy(state, t)}
      </p>
      {state === "unconfigured" ? (
        <a href={AI_FEATURES_GUIDE} className={cn(TEXT_LINK, "text-dense")}>
          {t("aiGuide")}
        </a>
      ) : null}
      {sendsCreative(state) ? (
        <p className="text-caption text-faint-foreground">
          {creativeSentLine(
            audit.ai.provider,
            state === "never" ? audit.ai.model : null,
            t,
          )}
        </p>
      ) : null}
    </div>
  );
}

function AnalysisHeader({
  state,
  heading,
}: {
  state: AnalysisState;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("audit");
  return (
    <CardHeader className={cn(PANEL_HEADER, "border-b border-border pb-3")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <CardTitle asChild>
          <h2
            id="ai-analysis-heading"
            ref={heading}
            tabIndex={-1}
            className="outline-none"
          >
            {t("analysisTitle")}
          </h2>
        </CardTitle>
        <StateMark state={state} />
      </div>
    </CardHeader>
  );
}

export function AiAnalysisPanel({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const t = useTranslations("audit");
  const queryClient = useQueryClient();
  const spent = useAiAllowanceSpent();
  const failAi = useAiFailureToast();
  const mutation = useMutation({
    mutationKey: ["audit-ai-run", appId],
    mutationFn: () => requestAiAuditRun(appId),
    onSuccess: async (result) => {
      if (result.reused) {
        toast.info(t("analysis.already"), {
          description: t("analysis.unchanged"),
        });
        return;
      }
      await queryClient.cancelQueries({ queryKey: appKeys.audit(appId) });
      queryClient.setQueryData(
        appKeys.audit(appId),
        (current?: AppAuditResult) =>
          current
            ? { ...current, ai: { ...current.ai, run: result } }
            : current,
      );
    },
    onError: (error) => failAi(error, t("analysis.queueFailed")),
    onSettled: () => invalidateAiUsage(queryClient),
  });
  const analyzeOnce = useSingleFlight(mutation);
  const state = analysisState(audit, mutation.isPending);
  const active = state === "active";
  const action = analysisAction(state, t);
  const heading = useFocusWhenQueued(mutation.isPending, active);

  useRunTransitions(appId, audit);

  return (
    <section id="ai-analysis" aria-labelledby="ai-analysis-heading">
      <Card className="gap-0 pb-0">
        <AnalysisHeader state={state} heading={heading} />
        <CardContent className="flex flex-col gap-3 py-4">
          <AnalysisIntro state={state} audit={audit} />
          {action ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button
                onClick={() => {
                  if (!mutation.isPending && !spent) analyzeOnce();
                }}
                aria-disabled={mutation.isPending || spent || undefined}
              >
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {action}
              </Button>
              <AiCallsLeft />
            </div>
          ) : null}
          <RunProgress
            active={active}
            analyzed={audit.creative?.screenshots.length ?? null}
            requestedAt={audit.ai.run?.requestedAt ?? null}
          />
          {state === "failed" ? (
            <Alert variant="destructive">
              <AlertTitle>{audit.ai.run?.error}</AlertTitle>
              <AlertDescription>{analysisCopy(state, t)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        {audit.creative ? (
          <CreativeObservations creative={audit.creative} />
        ) : null}
      </Card>
    </section>
  );
}
