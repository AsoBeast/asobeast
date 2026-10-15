import { Skeleton } from "@/components/ui/skeleton";

const FILTERS = 7;
const ROWS = 10;

export function ChartTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-col divide-y rounded-xl border">
        {Array.from({ length: ROWS }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="size-8 rounded-xl" />
            <div className="flex flex-col gap-1">
              <Skeleton shape="text" className="w-40" />
              <Skeleton shape="text" className="w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopChartsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton shape="text" className="w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: FILTERS }, (_, index) => (
          <Skeleton key={index} className="h-8 w-36" />
        ))}
      </div>
      <ChartTableSkeleton />
    </div>
  );
}
