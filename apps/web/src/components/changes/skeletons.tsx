import { CHANGE_IMPACT_WINDOWS } from "@asobeast/shared";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChangeTimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ChangesCardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent>
        <ChangeTimelineSkeleton />
      </CardContent>
    </Card>
  );
}

export function ChangeImpactSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {CHANGE_IMPACT_WINDOWS.map((days) => (
              <Skeleton key={days} className="h-36 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChangeImpactCardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-72" />
      </CardHeader>
      <CardContent>
        <ChangeImpactSkeleton />
      </CardContent>
    </Card>
  );
}
