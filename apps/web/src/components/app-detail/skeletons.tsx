import { Skeleton } from "@/components/ui/skeleton";

export function AppHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-[26px] w-48" />
          <Skeleton className="h-6 w-64 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

export function MarketSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-[34px] w-[240px] max-w-full" />
    </div>
  );
}
