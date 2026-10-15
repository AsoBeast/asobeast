import { Skeleton } from "@/components/ui/skeleton";
import type { ChartView } from "@/lib/search-params";

export const CHART_GRID =
  "grid gap-6 @4xl/charts:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0";
export const TRENDING_COLUMN =
  "@4xl/charts:sticky @4xl/charts:top-20 @4xl/charts:self-start";

export const COLUMNS_GRID = "grid gap-6 @4xl/charts:grid-cols-3 [&>*]:min-w-0";

const FILTERS = 6;
const ROWS = 10;
const KINDS = 3;

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="size-7 rounded-xl" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton shape="text" className="w-32 max-w-full" />
        <Skeleton shape="text" className="w-20" />
      </div>
    </div>
  );
}

export function ChartColumnsSkeleton() {
  return (
    <div className={COLUMNS_GRID}>
      {Array.from({ length: KINDS }, (_, kind) => (
        <div key={kind} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton shape="text" className="w-32" />
          {Array.from({ length: ROWS }, (_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      ))}
    </div>
  );
}

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

export function TrendingPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <Skeleton shape="text" className="w-20" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-xl" />
          <Skeleton shape="text" className="flex-1" />
          <Skeleton shape="text" className="w-12" />
        </div>
      ))}
    </div>
  );
}

export function TopChartsSkeleton({ view = "columns" }: { view?: ChartView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton shape="text" className="w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: FILTERS }, (_, index) => (
          <Skeleton key={index} className="h-8 w-36 rounded-full" />
        ))}
      </div>
      {view === "table" ? (
        <div className={CHART_GRID}>
          <ChartTableSkeleton />
          <div className={TRENDING_COLUMN}>
            <TrendingPanelSkeleton />
          </div>
        </div>
      ) : (
        <>
          <ChartColumnsSkeleton />
          <TrendingPanelSkeleton />
        </>
      )}
    </div>
  );
}
