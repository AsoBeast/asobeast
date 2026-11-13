import {
  AppsDashboardSkeleton,
  DashboardLedeSkeleton,
  DoNextCardSkeleton,
  PortfolioMoversCardSkeleton,
  PortfolioStatusLineSkeleton,
  FeedCardSkeleton,
  PortfolioPulseSkeleton,
} from "@/components/dashboard/skeletons";
import {
  SPLIT_NARROW,
  SPLIT_ROW,
  SPLIT_WIDE,
} from "@/components/dashboard/layout-classes";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide @container/dashboard flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <DashboardLedeSkeleton />
        <PortfolioStatusLineSkeleton />
      </div>
      <PortfolioPulseSkeleton />
      <div className={SPLIT_ROW}>
        <div className={SPLIT_WIDE}>
          <PortfolioMoversCardSkeleton />
        </div>
        <div className={SPLIT_NARROW}>
          <DoNextCardSkeleton />
        </div>
      </div>
      <AppsDashboardSkeleton />
      <div className={SPLIT_ROW}>
        <div className={SPLIT_WIDE}>
          <FeedCardSkeleton />
        </div>
        <div className={SPLIT_NARROW}>
          <FeedCardSkeleton />
        </div>
      </div>
    </div>
  );
}
