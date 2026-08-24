import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const MIN_TREND_POINTS = 4;

export type ChartState = "empty" | "insufficient" | "ready";

export function trendState(points: number): ChartState {
  if (points === 0) return "empty";
  if (points < MIN_TREND_POINTS) return "insufficient";
  return "ready";
}

export function ChartSkeleton({ height }: { height: string }) {
  return <Skeleton className={cn("w-full", height)} />;
}

export function ChartNotice({
  height,
  title,
  body,
}: {
  height: string;
  title: string;
  body?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-6 text-center",
        height,
      )}
    >
      <p className="text-body font-medium">{title}</p>
      {body ? (
        <p className="text-caption text-muted-foreground">{body}</p>
      ) : null}
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
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-6 text-center",
        height,
      )}
    >
      <p className="text-label text-muted-foreground uppercase">{label}</p>
      <p className="numeric font-mono text-display">{value}</p>
      <p className="text-caption text-muted-foreground">{note}</p>
    </div>
  );
}
