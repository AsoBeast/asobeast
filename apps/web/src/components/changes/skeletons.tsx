import { CHANGE_IMPACT_WINDOWS } from "@asobeast/shared";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANGES_GRID, CHANGES_MAIN, CHANGES_RAIL } from "./layout-classes";

const TIMELINE_ROWS = 5;
const IMPACT_ROWS = 2;
const FIELD_ROWS = 5;

export function LedeSkeleton() {
  return <Skeleton className="h-5 w-96 max-w-full" />;
}

function PanelHeaderSkeleton({ width }: { width: string }) {
  return (
    <CardHeader className={PANEL_HEADER}>
      <Skeleton className={`h-5 max-w-full ${width}`} />
    </CardHeader>
  );
}

export function ChangeActivitySkeleton() {
  return (
    <Card>
      <PanelHeaderSkeleton width="w-56" />
      <CardContent className="flex flex-col gap-3">
        <ChartSkeleton height={CHART_HEIGHT.compact} />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

export function ChangeImpactSkeleton() {
  return (
    <CardContent className="flex flex-col gap-4">
      {Array.from({ length: IMPACT_ROWS }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 sm:grid-cols-[minmax(11rem,0.9fr)_3fr]"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40 max-w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {CHANGE_IMPACT_WINDOWS.map((days) => (
              <Skeleton key={days} className="h-24" />
            ))}
          </div>
        </div>
      ))}
    </CardContent>
  );
}

function ChangeImpactCardSkeleton() {
  return (
    <Card>
      <PanelHeaderSkeleton width="w-32" />
      <ChangeImpactSkeleton />
    </Card>
  );
}

export function ChangesCardSkeleton() {
  return (
    <Card>
      <PanelHeaderSkeleton width="w-36" />
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: TIMELINE_ROWS }).map((_, index) => (
          <div key={index} className="flex min-h-7 items-center gap-3">
            <Skeleton className="size-6 rounded-[5px]" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24 max-sm:hidden" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-[22px] w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function FieldBreakdownSkeleton() {
  return (
    <Card>
      <PanelHeaderSkeleton width="w-28" />
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: FIELD_ROWS }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function ChangesPageSkeleton() {
  return (
    <div className="@container/changes page-wide flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-80 max-w-full" />
        <LedeSkeleton />
      </div>
      <ChangeActivitySkeleton />
      <ChangeImpactCardSkeleton />
      <div className={CHANGES_GRID}>
        <div className={CHANGES_MAIN}>
          <ChangesCardSkeleton />
        </div>
        <div className={CHANGES_RAIL}>
          <FieldBreakdownSkeleton />
        </div>
      </div>
    </div>
  );
}
