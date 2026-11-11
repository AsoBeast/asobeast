import { AppHeaderSkeleton } from "@/components/app-detail/skeletons";
import {
  OverviewPulseSkeleton,
  SnapshotFactsSkeleton,
} from "@/components/overview/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <AppHeaderSkeleton />

      <div className="page-wide @container/overview flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SnapshotFactsSkeleton />
          <Skeleton className="h-8 w-28" />
        </div>
        <OverviewPulseSkeleton />
      </div>
    </div>
  );
}
