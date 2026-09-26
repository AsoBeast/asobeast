import { AppHeaderSkeleton } from "@/components/app-detail/skeletons";
import { StatCardsSkeleton } from "@/components/overview/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <AppHeaderSkeleton />

      <div className="page-wide flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-7 w-28" />
        </div>
        <StatCardsSkeleton />
      </div>
    </div>
  );
}
