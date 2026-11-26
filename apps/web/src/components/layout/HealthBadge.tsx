"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import type { HealthStatus } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/use-auth";
import { healthOptions } from "@/lib/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { answeredDatabaseDown } from "./health-answer";

type Translator = ReturnType<typeof useTranslations>;

function hoursAgo(iso: string): number {
  return Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000),
  );
}

function degradedDetail(data: HealthStatus, t: Translator): string | null {
  const causes: string[] = [];
  if (data.redis === "down") {
    causes.push(t("redisUnavailable"));
  }
  const pipeline = data.pipeline;
  if (pipeline?.stale) {
    causes.push(
      pipeline.lastDailyRunAt
        ? t("lastDailyRun", { hours: hoursAgo(pipeline.lastDailyRunAt) })
        : t("pipelineStalled"),
    );
  }
  if (pipeline && pipeline.failedJobs > 0) {
    causes.push(t("failedJobs", { count: pipeline.failedJobs }));
  }
  return causes.length > 0 ? causes.join(" · ") : null;
}

interface BadgeState {
  mark: ReactNode;
  label: string;
  detail: string;
}

const dotMark = (className: string) => (
  <span className={cn("size-2 rounded-full", className)} />
);

const glyphMark = (Icon: LucideIcon, className: string) => (
  <Icon className={cn("size-3.5", className)} />
);

function resolveState(
  data: HealthStatus | undefined,
  error: unknown,
  isPending: boolean,
  t: Translator,
): BadgeState {
  if (isPending) {
    return {
      mark: dotMark("bg-muted-foreground animate-pulse"),
      label: t("api"),
      detail: t("checking"),
    };
  }
  if (answeredDatabaseDown(error)) {
    return {
      mark: glyphMark(TriangleAlert, "text-warning"),
      label: t("degraded"),
      detail: t("databaseUnavailable"),
    };
  }
  if (error || data?.status !== "ok") {
    return {
      mark: glyphMark(CircleX, "text-destructive"),
      label: t("unreachable"),
      detail: t("apiUnreachable"),
    };
  }
  const detail = degradedDetail(data, t);
  if (detail) {
    return {
      mark: glyphMark(TriangleAlert, "text-warning"),
      label: t("degraded"),
      detail,
    };
  }
  return {
    mark: dotMark("bg-success"),
    label: t("api"),
    detail: t("healthy"),
  };
}

export function HealthBadge() {
  const { isOperator } = useAuth();
  return isOperator ? <ApiStatus /> : null;
}

function ApiStatus() {
  const t = useTranslations("navigation.health");
  const { data, error, isPending } = useQuery(healthOptions);
  const state = resolveState(data, error, isPending, t);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5">
          {state.mark}
          <span className="sr-only sm:not-sr-only">{state.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{state.detail}</TooltipContent>
    </Tooltip>
  );
}
