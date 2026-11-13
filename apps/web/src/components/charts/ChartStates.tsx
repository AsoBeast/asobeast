import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const MIN_TREND_POINTS = 4;

export type ChartState = "empty" | "insufficient" | "ready";

export function trendState(points: number): ChartState {
  if (points === 0) return "empty";
  if (points < MIN_TREND_POINTS) return "insufficient";
  return "ready";
}

export function ChartSkeleton({
  height,
  className,
}: {
  height: string;
  className?: string;
}) {
  return <Skeleton className={cn("w-full", height, className)} />;
}

export const CHART_NOTICE = "flex flex-col items-start justify-center gap-1";

export function ChartNotice({
  height,
  title,
  body,
  action,
}: {
  height: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn(CHART_NOTICE, height)}>
      <p className="max-w-prose text-body font-medium">{title}</p>
      {body ? (
        <p className="max-w-prose text-body text-muted-foreground">{body}</p>
      ) : null}
      {action}
    </div>
  );
}

export function ChartStat({
  height,
  label,
  value,
  note,
}: {
  height: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={cn(CHART_NOTICE, height)}>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="numeric text-title">{value}</p>
      <p className="text-caption text-muted-foreground">{note}</p>
    </div>
  );
}
