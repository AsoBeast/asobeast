import { CHART_HEIGHT } from "@/components/charts/theme";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup, StatTileSkeleton } from "@/components/ui/stat-tile";

const TILE_COUNT = 7;

function CardHeaderSkeleton() {
  return (
    <CardHeader className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatTileGroup>
        {Array.from({ length: TILE_COUNT }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </StatTileGroup>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeaderSkeleton />
          <CardContent>
            <ChartSkeleton height={CHART_HEIGHT.compact} />
          </CardContent>
        </Card>
        <Card>
          <CardHeaderSkeleton />
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AdminCapacitySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeaderSkeleton />
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeaderSkeleton />
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="ml-auto h-5 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-xl border">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
