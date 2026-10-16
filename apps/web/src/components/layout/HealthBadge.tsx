"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import type { HealthStatus } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import { ApiError } from "@/lib/api";
import { healthOptions } from "@/lib/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function hoursAgo(iso: string): number {
  return Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000),
  );
}

function degradedDetail(data: HealthStatus): string | null {
  const causes: string[] = [];
  if (data.redis === "down") {
    causes.push("Redis unavailable");
  }
  const pipeline = data.pipeline;
  if (pipeline?.stale) {
    causes.push(
      pipeline.lastDailyRunAt
        ? `Last daily run ${hoursAgo(pipeline.lastDailyRunAt)}h ago`
        : "Daily pipeline stalled",
    );
  }
  if (pipeline && pipeline.failedJobs > 0) {
    causes.push(
      `${pipeline.failedJobs} failed job${
        pipeline.failedJobs === 1 ? "" : "s"
      } — check /admin/queues`,
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
): BadgeState {
  if (isPending) {
    return {
      mark: dotMark("bg-muted-foreground animate-pulse"),
      label: "api",
      detail: "Checking API status…",
    };
  }
  if (data?.status === "ok") {
    const detail = degradedDetail(data);
    if (detail) {
      return {
        mark: glyphMark(TriangleAlert, "text-warning"),
        label: "degraded",
        detail,
      };
    }
    return {
      mark: dotMark("bg-success"),
      label: "api",
      detail: "API healthy · database up",
    };
  }
  if (error instanceof ApiError) {
    return {
      mark: glyphMark(TriangleAlert, "text-warning"),
      label: "degraded",
      detail: "API up · database unavailable",
    };
  }
  return {
    mark: glyphMark(CircleX, "text-destructive"),
    label: "unreachable",
    detail: "API unreachable",
  };
}

export function HealthBadge() {
  const { isOperator } = useAuth();
  return isOperator ? <ApiStatus /> : null;
}

function ApiStatus() {
  const { data, error, isPending } = useQuery(healthOptions);
  const state = resolveState(data, error, isPending);

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
