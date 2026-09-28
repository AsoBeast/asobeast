import type { AppView } from "@/lib/search-params";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup } from "@/components/ui/stat-tile";

export const PULSE_GRID = "grid-cols-2 @3xl/dashboard:grid-cols-4";

export const APP_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]";

export function PortfolioPulseSkeleton() {
  return (
    <StatTileGroup className={PULSE_GRID}>
      {Array.from({ length: 4 }).map((_, index) => (
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

export function PortfolioStatusLineSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-5 w-72 max-w-full" />
    </div>
  );
}

function MoverListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-20" />
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PortfolioMoversCardSkeleton() {
  return (
    <Card className="@container/movers">
      <CardHeader className="gap-1">
        <Skeleton className="h-5.5 w-36" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-6 @md/movers:grid-cols-2">
        <MoverListSkeleton />
        <div className="hidden @md/movers:block">
          <MoverListSkeleton />
        </div>
      </CardContent>
    </Card>
  );
}

function AppCardSkeleton() {
  return (
    <Card className="h-full gap-0 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-4xl" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="my-2 h-1.5 w-full rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
    </Card>
  );
}

function PortfolioTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-24 self-end" />
      <div className="flex flex-col gap-2 rounded-xl border p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function AppsDashboardSkeleton({ view = "cards" }: { view?: AppView }) {
  if (view === "table") return <PortfolioTableSkeleton />;

  return (
    <ul className={APP_GRID}>
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index}>
          <AppCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
