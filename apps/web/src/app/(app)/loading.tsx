import {
  AppsDashboardSkeleton,
  PortfolioStatusLineSkeleton,
  PortfolioTotalsSkeleton,
} from "@/components/dashboard/skeletons";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide @container/dashboard flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <PortfolioStatusLineSkeleton />
      </div>
      <PortfolioTotalsSkeleton />
      <div className="grid gap-6 @5xl/dashboard:grid-cols-12 [&>*]:min-w-0">
        <div className="@5xl/dashboard:col-span-7">
          <ActionsSummaryCardSkeleton />
        </div>
      </div>
      <div className="grid gap-6 @6xl/dashboard:grid-cols-12 [&>*]:min-w-0">
        <div className="flex flex-col gap-4 @6xl/dashboard:col-span-8">
          <Skeleton className="h-6 w-16" />
          <AppsDashboardSkeleton />
        </div>
        <Card className="@6xl/dashboard:col-span-4">
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
