import { CHART_HEIGHT } from "@/components/charts/theme";
import { Skeleton } from "@/components/ui/skeleton";

const PANEL = "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card";
const PANEL_TOP = "flex min-h-[47px] items-center border-b px-4";

export function InspectionScoresSkeleton() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-3 border-y">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 px-4 pt-3 pb-3.5 not-first:border-l"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-1 w-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function InspectionDetailSkeleton() {
  return (
    <div aria-hidden className="-mt-px flex flex-col">
      <InspectionScoresSkeleton />
    </div>
  );
}

export function InspectionMapSkeleton() {
  return (
    <div className={PANEL} aria-hidden>
      <div className={PANEL_TOP}>
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="p-3">
        <Skeleton className={`${CHART_HEIGHT.hero} rounded-md`} />
      </div>
      <div className="border-t px-4 py-3">
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  );
}

export function InspectionLogSkeleton() {
  return (
    <div className={PANEL} aria-hidden>
      <div className={PANEL_TOP}>
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function DetailPanelSkeleton() {
  return (
    <div className={PANEL} aria-hidden>
      <div className={PANEL_TOP}>
        <Skeleton className="h-5 w-40" />
      </div>
      <InspectionDetailSkeleton />
    </div>
  );
}

export function InspectWorkspaceSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <InspectionMapSkeleton />
      <div className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <DetailPanelSkeleton />
      </div>
      <div className="xl:col-start-1 xl:row-start-2">
        <InspectionLogSkeleton />
      </div>
    </div>
  );
}

export function InspectPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Skeleton className="h-8 w-56" />
        <div className="flex w-full flex-col gap-1.5 xl:w-auto xl:items-end">
          <Skeleton className="h-9 w-full xl:w-[46rem]" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <InspectWorkspaceSkeleton />
    </div>
  );
}
