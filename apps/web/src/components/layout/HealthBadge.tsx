"use client";

import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import type { HealthStatus } from "@asobeast/shared";
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
  dot: string;
  label: string;
  detail: string;
  degraded?: boolean;
}

function resolveState(
  data: HealthStatus | undefined,
  error: unknown,
  isPending: boolean,
): BadgeState {
  if (isPending) {
    return {
      dot: "bg-muted-foreground animate-pulse",
      label: "api",
      detail: "Checking API status…",
    };
  }
  if (data?.status === "ok") {
    const detail = degradedDetail(data);
    if (detail) {
      return { dot: "bg-warning", label: "degraded", detail, degraded: true };
    }
    return {
      dot: "bg-success",
      label: "api",
      detail: "API healthy · database up",
    };
  }
  if (error instanceof ApiError) {
    return {
      dot: "bg-warning",
      label: "degraded",
      detail: "API up · database unavailable",
      degraded: true,
    };
  }
  return {
    dot: "bg-destructive",
    label: "unreachable",
    detail: "API unreachable",
  };
}

export function HealthBadge() {
  const { data, error, isPending } = useQuery(healthOptions);
  const state = resolveState(data, error, isPending);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5">
          {state.degraded ? (
            <TriangleAlert className="size-3.5 text-warning" />
          ) : (
            <span className={cn("size-2 rounded-full", state.dot)} />
          )}
          <span>{state.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{state.detail}</TooltipContent>
    </Tooltip>
  );
}
