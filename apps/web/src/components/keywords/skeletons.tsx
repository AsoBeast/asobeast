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

export function KeywordFieldSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-1 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-9 w-40 rounded-lg" />
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
