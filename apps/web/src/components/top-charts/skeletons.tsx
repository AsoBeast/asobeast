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
const PANEL = "flex flex-col rounded-lg border bg-card";
const PANEL_HEAD = "flex h-[47px] items-center border-b px-4";
const LIST_ROW = "flex h-10 items-center gap-2 px-2 sm:h-9";

function RowSkeleton() {
  return (
    <div className={LIST_ROW}>
      <Skeleton className="h-4 w-6" />
      <Skeleton className="size-4 rounded-sm" />
      <Skeleton shape="text" className="w-32 max-w-full" />
      <Skeleton shape="text" className="ml-auto w-8" />
    </div>
  );
}

export function ChartColumnsSkeleton() {
  return (
    <div className={COLUMNS_GRID}>
      {Array.from({ length: KINDS }, (_, kind) => (
        <div key={kind} className={PANEL}>
          <div className={PANEL_HEAD}>
            <Skeleton shape="text" className="w-20" />
          </div>
          <div className="flex flex-col p-2">
            {Array.from({ length: ROWS }, (_, index) => (
              <RowSkeleton key={index} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartTableSkeleton() {
  return (
    <div className={PANEL}>
      <div className={PANEL_HEAD}>
        <Skeleton shape="text" className="w-20" />
      </div>
      <div className="flex flex-col divide-y">
        {Array.from({ length: ROWS }, (_, index) => (
          <div key={index} className="flex h-11 items-center gap-3 px-4">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="size-6 rounded-sm" />
            <Skeleton shape="text" className="w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendingPanelSkeleton() {
  return (
    <div className={PANEL}>
      <div className={PANEL_HEAD}>
        <Skeleton shape="text" className="w-40" />
      </div>
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="mx-2 h-9" />
        {Array.from({ length: 5 }, (_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function TopChartsSkeleton({ view = "columns" }: { view?: ChartView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton shape="text" className="w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: FILTERS }, (_, index) => (
          <Skeleton key={index} className="h-9 w-36" />
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
