import {
  DoNextCardSkeleton,
  PortfolioMoversCardSkeleton,
} from "@/components/dashboard/skeletons";
import {
  CoverageCardSkeleton,
  OverviewMarketSkeleton,
  OverviewPulseSkeleton,
  SnapshotFactsSkeleton,
} from "@/components/overview/skeletons";
import {
  SPLIT_NARROW,
  SPLIT_ROW,
  SPLIT_WIDE,
} from "@/components/overview/layout-classes";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide @container/overview flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SnapshotFactsSkeleton />
        <div className="flex flex-wrap items-center gap-3">
          <OverviewMarketSkeleton />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <OverviewPulseSkeleton />
      <div className={SPLIT_ROW}>
        <div className={SPLIT_WIDE}>
          <PortfolioMoversCardSkeleton />
        </div>
        <div className={SPLIT_NARROW}>
          <DoNextCardSkeleton />
          <CoverageCardSkeleton />
        </div>
      </div>
    </div>
  );
}
