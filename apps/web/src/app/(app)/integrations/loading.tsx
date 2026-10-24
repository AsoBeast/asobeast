import { StoreConnectionsSkeleton } from "@/components/integrations/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <StoreConnectionsSkeleton />
      </div>
    </div>
  );
}
