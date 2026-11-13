import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricStripSkeleton } from "@/components/ui/stat-tile";
import { REVIEWS_GRID, REVIEWS_MAIN, REVIEWS_RAIL } from "./layout-classes";

const DISTRIBUTION_ROWS = 5;
const REVIEW_ROWS = 4;

export function LedeSkeleton() {
  return <Skeleton className="h-5 w-96 max-w-full" />;
}

export function ReplySwitchSkeleton() {
  return <Skeleton className="h-8 w-64 max-w-full" />;
}

export function ReviewsListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {Array.from({ length: REVIEW_ROWS }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 p-4 max-sm:px-3">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function RatingsPanelSkeleton({ className }: { className: string }) {
  return (
    <Card className={`gap-0 py-0 ${className}`}>
      <MetricStripSkeleton columns={2} framed={false} />
      <CardContent className="flex flex-col gap-2 border-t border-border pt-3 pb-4">
        <div className="flex min-h-8 items-center justify-between gap-4">
          <Skeleton className="h-4 w-32 max-w-full" />
          <Skeleton className="h-8 w-28" />
        </div>
        <ChartSkeleton height={CHART_HEIGHT.tall} />
      </CardContent>
    </Card>
  );
}

function DistributionSkeleton({ className }: { className: string }) {
  return (
    <Card className={className}>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-40 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2">
        {Array.from({ length: DISTRIBUTION_ROWS + 1 }).map((_, index) => (
          <div key={index} className="flex h-10 items-center px-2 sm:h-9">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ReviewsPageSkeleton() {
  return (
    <div className="@container/reviews flex flex-col gap-6">
      <LedeSkeleton />
      <div className={REVIEWS_GRID}>
        <div className={REVIEWS_MAIN}>
          <RatingsPanelSkeleton className="order-1 min-w-0" />
          <Card className="order-3 min-w-0">
            <CardHeader className={`${PANEL_HEADER} flex justify-between`}>
              <Skeleton className="h-5 w-24" />
              <ReplySwitchSkeleton />
            </CardHeader>
            <CardContent className="px-0">
              <ReviewsListSkeleton />
            </CardContent>
          </Card>
        </div>
        <div className={REVIEWS_RAIL}>
          <DistributionSkeleton className="order-2 min-w-0" />
        </div>
      </div>
    </div>
  );
}
