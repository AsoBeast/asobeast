import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompetitorListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

export function DiscoveryPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function DiscoveryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent>
        <DiscoveryPanelSkeleton />
      </CardContent>
    </Card>
  );
}

export function ComparisonMatrixSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export function GapAnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-8 w-40" />
      </div>
      <div className="flex flex-col rounded-xl border">
        <Skeleton className="h-10 rounded-none rounded-t-xl" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex h-12 items-center gap-4 px-2">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
