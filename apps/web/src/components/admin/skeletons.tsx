import { CHART_HEIGHT } from "@/components/charts/theme";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL_BLEED, PANEL_HEADER } from "@/components/layout/panel-classes";
import { MetricStripSkeleton } from "@/components/ui/stat-tile";

function CardHeaderSkeleton() {
  return (
    <CardHeader className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>
  );
}

function ListPanelSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <MetricStripSkeleton columns={4} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ListPanelSkeleton rows={6} />
          <Card>
            <CardHeader className={PANEL_HEADER}>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <ChartSkeleton height={CHART_HEIGHT.compact} />
            </CardContent>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ListPanelSkeleton rows={5} />
          <ListPanelSkeleton rows={7} />
        </div>
      </div>
    </div>
  );
}

export function AdminConversionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ListPanelSkeleton rows={8} />
      <ListPanelSkeleton rows={3} />
    </div>
  );
}

export function AdminCapacitySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeaderSkeleton />
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeaderSkeleton />
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="ml-auto h-9 w-24" />
      </div>
      <Card>
        <CardContent className={`${PANEL_BLEED} flex flex-col gap-px`}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-none" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
