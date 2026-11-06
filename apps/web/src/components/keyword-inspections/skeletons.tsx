import { Skeleton } from "@/components/ui/skeleton";

export function InspectionScoresSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-md" />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-10 rounded-md" />
      ))}
    </div>
  );
}

export function InspectionDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <InspectionScoresSkeleton />
    </div>
  );
}

export function InspectionMapSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-6"
      aria-hidden
    >
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-[300px] rounded-md sm:h-[420px]" />
      <Skeleton className="h-8 w-3/4 rounded-full" />
    </div>
  );
}

export function InspectionLogSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

export function InspectWorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_30rem]">
        <InspectionMapSkeleton />
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <InspectionDetailSkeleton />
        </div>
      </div>
      <InspectionLogSkeleton />
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
      <InspectWorkspaceSkeleton />
    </div>
  );
}
