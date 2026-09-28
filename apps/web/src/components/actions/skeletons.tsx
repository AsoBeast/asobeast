import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup } from "@/components/ui/stat-tile";

export const OVERVIEW_GRID = "grid-cols-2 @3xl/actions:grid-cols-4";

export const ACTIONS_GRID =
  "grid gap-6 @5xl/actions:grid-cols-12 [&>*]:min-w-0";

export const QUEUE_COLUMN =
  "@container/queue flex flex-col gap-4 @5xl/actions:col-span-8";

export const RAIL_COLUMN =
  "flex flex-col gap-6 @5xl/actions:sticky @5xl/actions:top-20 @5xl/actions:col-span-4 @5xl/actions:self-start";

export function ActionStatusLineSkeleton() {
  return (
    <Skeleton className="h-10 w-full max-w-xl rounded-md @3xl/actions:h-5" />
  );
}

export function ActionHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-56 rounded-md" />
      <ActionStatusLineSkeleton />
    </div>
  );
}

export function ActionOverviewSkeleton() {
  return (
    <StatTileGroup className={OVERVIEW_GRID}>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          data-slot="stat-tile-skeleton"
          className="row-span-3 grid grid-rows-subgrid gap-1 rounded-xl border bg-card px-4 py-3"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-12 self-end" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </StatTileGroup>
  );
}

export function ActionToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-80 max-w-full rounded-lg" />
      <Skeleton className="h-9 w-full max-w-xl rounded-md" />
      <Skeleton className="h-7 w-full max-w-2xl rounded-md" />
      <Skeleton className="h-6 w-32 rounded-md" />
    </div>
  );
}

export function ActionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className="h-[143px] w-full rounded-lg @md/queue:h-[72px]"
        />
      ))}
    </div>
  );
}

export function ActionQueueSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <ActionListSkeleton />
    </div>
  );
}

export function ActionRailSkeleton() {
  return (
    <div className={RAIL_COLUMN}>
      <ChartSkeleton height={CHART_HEIGHT.compact} />
      <ChartSkeleton height={CHART_HEIGHT.compact} />
    </div>
  );
}

export function ActionCenterSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ActionHeaderSkeleton />
      <ActionOverviewSkeleton />
      <div className={ACTIONS_GRID}>
        <div className={QUEUE_COLUMN}>
          <ActionToolbarSkeleton />
          <ActionQueueSkeleton />
        </div>
        <ActionRailSkeleton />
      </div>
    </div>
  );
}

export function ActionsSummaryCardSkeleton() {
  return <Skeleton className="h-[196px] w-full rounded-xl" />;
}
