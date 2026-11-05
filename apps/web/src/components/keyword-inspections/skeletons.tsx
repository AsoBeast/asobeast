import { Skeleton } from "@/components/ui/skeleton";

export function InspectionDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function InspectionHistorySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}

export function InspectPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <InspectionDetailSkeleton />
        <InspectionHistorySkeleton />
      </div>
    </div>
  );
}
