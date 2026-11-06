import type { AppView } from "@/lib/search-params";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup, StatTileSkeleton } from "@/components/ui/stat-tile";

export const PULSE_GRID = "grid-cols-2 @3xl/dashboard:grid-cols-4";

export const PULSE_STRIP = `${PULSE_GRID} rounded-none border-0`;

export const APP_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]";

export function PortfolioPulseSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <StatTileGroup className={PULSE_STRIP}>
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </StatTileGroup>
      <div className="flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4">
        <Skeleton className="h-5 w-32" />
        <ChartSkeleton height={CHART_HEIGHT.tall} />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

export function PortfolioStatusLineSkeleton() {
  return <Skeleton className="h-4 w-96 max-w-full" />;
}

function RowsSkeleton({ rows, height }: { rows: number; height: string }) {
  return (
    <div className="flex flex-col px-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={`flex items-center ${height}`}>
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton({
  rows,
  height,
  columns = false,
}: {
  rows: number;
  height: string;
  columns?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1 px-2">
        {columns ? <Skeleton className="mx-2 h-4 w-24" /> : null}
        <RowsSkeleton rows={rows} height={height} />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-4 w-48" />
      </CardFooter>
    </Card>
  );
}

export function PortfolioMoversCardSkeleton() {
  return <PanelSkeleton rows={5} height="h-10 sm:h-9" columns />;
}

export function DoNextCardSkeleton() {
  return <PanelSkeleton rows={5} height="h-16" />;
}

function AppCardSkeleton() {
  return (
    <Card className="h-full gap-0 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[22px] w-24 rounded-md" />
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
