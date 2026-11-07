import { CHART_HEIGHT } from "@/components/charts/theme";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StatTileGroup, StatTileSkeleton } from "@/components/ui/stat-tile";

export function ReviewCountsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <StatTileGroup className="grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </StatTileGroup>
    </div>
  );
}

export function ReviewsListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 pl-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ReviewsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className={cn(CHART_HEIGHT.compact, "w-full")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <ReviewsListSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
