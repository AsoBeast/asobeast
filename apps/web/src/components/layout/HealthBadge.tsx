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
import type { TranslationContext } from "@/i18n/translator";
import { useAppLocale } from "@/lib/use-app-locale";

function hoursAgo(iso: string): number {
  return Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000),
  );
}

function degradedDetail(
  data: HealthStatus,
  context: TranslationContext,
): string | null {
  const causes: string[] = [];
  if (data.redis === "down") {
    causes.push(context.translator("redisUnavailable"));
  }
  const pipeline = data.pipeline;
  if (pipeline?.stale) {
    causes.push(
      pipeline.lastDailyRunAt
        ? context.translator("lastDailyRun", {
            hours: hoursAgo(pipeline.lastDailyRunAt),
          })
        : context.translator("pipelineStalled"),
    );
  }
  if (pipeline && pipeline.failedJobs > 0) {
    causes.push(
      context.translator("failedJobs", { count: pipeline.failedJobs }),
    );
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
  context: TranslationContext,
): BadgeState {
  if (isPending) {
    return {
      mark: dotMark("bg-muted-foreground animate-pulse"),
      label: context.translator("api"),
      detail: context.translator("checking"),
    };
  }
  if (answeredDatabaseDown(error)) {
    return {
      mark: glyphMark(TriangleAlert, "text-warning"),
      label: context.translator("degraded"),
      detail: context.translator("databaseUnavailable"),
    };
  }
  if (error || data?.status !== "ok") {
    return {
      mark: glyphMark(CircleX, "text-destructive"),
      label: context.translator("unreachable"),
      detail: context.translator("apiUnreachable"),
    };
  }
  const detail = degradedDetail(data, context);
  if (detail) {
    return {
      mark: glyphMark(TriangleAlert, "text-warning"),
      label: context.translator("degraded"),
      detail,
    };
  }
  return {
    mark: dotMark("bg-success"),
    label: context.translator("api"),
    detail: context.translator("healthy"),
  };
}

export function HealthBadge() {
  const { isOperator } = useAuth();
  return isOperator ? <ApiStatus /> : null;
}

function ApiStatus() {
  const locale = useAppLocale();
  const t = useTranslations("shell.health");
  const { data, error, isPending } = useQuery(healthOptions);
  const state = resolveState(data, error, isPending, {
    translator: t,
    locale,
  });

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
