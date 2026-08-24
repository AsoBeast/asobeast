import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompetitorListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </CardContent>
    </Card>
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
