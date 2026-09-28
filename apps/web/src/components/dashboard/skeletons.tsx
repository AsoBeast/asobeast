import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGroup } from "@/components/ui/stat-tile";

export function PortfolioTotalsSkeleton() {
  return (
    <StatTileGroup>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </StatTileGroup>
  );
}

export function AppsDashboardSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index}>
          <Card className="gap-0 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-4">
                <Skeleton className="size-12 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-24 rounded-4xl" />
                </div>
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
