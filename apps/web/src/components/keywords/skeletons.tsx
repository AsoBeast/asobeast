import { Skeleton } from "@/components/ui/skeleton";

export function KeywordsTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-4 border-b px-4 py-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-16" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: 7 }).map((__, cell) => (
              <Skeleton key={cell} className="h-5 w-16" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketSearchReadsSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-44" />
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-1 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function KeywordCombinationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
