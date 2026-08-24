import {
  AppsDashboardSkeleton,
  PortfolioTotalsSkeleton,
} from "@/components/apps/skeletons";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
      <PortfolioTotalsSkeleton />
      <ActionsSummaryCardSkeleton />
      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <AppsDashboardSkeleton />
        </div>
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
