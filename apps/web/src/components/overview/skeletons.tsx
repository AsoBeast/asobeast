import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_HEADER } from "@/components/dashboard/layout-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup, StatTileSkeleton } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";
import { PULSE_COLUMNS, PULSE_STRIP } from "./layout-classes";

export function SnapshotFactsSkeleton() {
  return <Skeleton className="h-5 w-80 max-w-full" />;
}

export function OverviewPulseSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <StatTileGroup className={cn(PULSE_STRIP, PULSE_COLUMNS[4])}>
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </StatTileGroup>
      <CardContent className="flex flex-col gap-2 border-t border-border pt-3 pb-4">
        <div className="flex min-h-8 items-center justify-between gap-4">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-8 w-24" />
        </div>
        <ChartSkeleton height={CHART_HEIGHT.tall} />
      </CardContent>
    </Card>
  );
}

export function CoverageCardSkeleton() {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64 max-w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-4 w-48" />
      </CardFooter>
    </Card>
  );
}

export function FunnelTilesSkeleton() {
  return (
    <>
      <StatTileGroup className={cn(PULSE_STRIP, PULSE_COLUMNS[4])}>
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </StatTileGroup>
      <CardFooter>
        <Skeleton className="h-4 w-96 max-w-full" />
      </CardFooter>
    </>
  );
}

export function FunnelCardSkeleton() {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className={cn(PANEL_HEADER, "border-b border-border")}>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <FunnelTilesSkeleton />
    </Card>
  );
}

export function RatingsByMarketSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function GapHeadlineSkeleton() {
  return <Skeleton aria-hidden className="h-4 w-full max-w-xl" />;
}
