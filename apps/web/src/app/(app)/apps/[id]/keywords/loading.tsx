import { KeywordsTableSkeleton } from "@/components/keywords/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-56" />
      </div>
      <KeywordsTableSkeleton />
    </div>
  );
}
