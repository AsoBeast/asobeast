import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup } from "@/components/ui/stat-tile";

export function ActionFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-full max-w-md rounded-md" />
      <Skeleton className="h-8 w-full max-w-sm rounded-md" />
      <Skeleton className="h-8 w-full max-w-2xl rounded-md" />
    </div>
  );
}

export function ActionListSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} className="h-[248px] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ActionCenterHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-56 rounded-md" />
      <Skeleton className="h-6 w-full max-w-md rounded-md" />
    </div>
  );
}

export const OVERVIEW_GRID = "grid-cols-2 @3xl/actions:grid-cols-4";

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

export function ActionCenterSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ActionCenterHeaderSkeleton />
      <ActionOverviewSkeleton />
      <ActionFiltersSkeleton />
      <ActionListSkeleton />
    </div>
  );
}

export function ActionsSummaryCardSkeleton() {
  return <Skeleton className="h-[196px] w-full rounded-xl" />;
}
