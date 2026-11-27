import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { iconRadius } from "@/lib/app-icon-radius";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricStripSkeleton } from "@/components/ui/stat-tile";
import {
  BREAKDOWN_HEADER,
  BREAKDOWN_PANEL,
  PULSE_BODY,
  PULSE_SPLIT,
} from "./layout-classes";
import { LEDE, PANEL_HEADER } from "@/components/layout/panel-classes";
import { cn } from "@/lib/utils";

export function MetricPanelSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-4">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <ChartSkeleton height={CHART_HEIGHT.tall} />
    </div>
  );
}

function BreakdownSkeleton({ rows }: { rows: number }) {
  return (
    <div className={BREAKDOWN_PANEL}>
      <div className={BREAKDOWN_HEADER}>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="px-2 pt-1 text-label">
        <Skeleton shape="text" className="inline-block w-10 align-middle" />
      </div>
      <RowsSkeleton rows={rows} height="h-10 sm:h-9" />
      <div className="mt-auto px-2 pt-2 text-caption">
        <Skeleton shape="text" className="inline-block w-40 align-middle" />
      </div>
    </div>
  );
}

export function PortfolioPulseSkeleton({ rows = 0 }: { rows?: number }) {
  return (
    <Card className="gap-0 py-0">
      <MetricStripSkeleton columns={4} framed={false} />
      <div className={cn(PULSE_BODY, rows > 0 && PULSE_SPLIT)}>
        <div className="min-w-0 px-4 pt-3 pb-4">
          <MetricPanelSkeleton />
        </div>
        {rows > 0 ? <BreakdownSkeleton rows={rows} /> : null}
      </div>
    </Card>
  );
}

export function PortfolioStatusLineSkeleton() {
  return <Skeleton className="h-4 w-96 max-w-full" />;
}

function RowsSkeleton({ rows, height }: { rows: number; height: string }) {
  return (
    <div className="flex flex-col px-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={`flex items-center ${height}`}>
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton({
  rows,
  height,
  columns = false,
  footer = true,
}: {
  rows: number;
  height: string;
  columns?: boolean;
  footer?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-32" />
        {columns ? (
          <CardAction>
            <Skeleton className="h-8 w-44" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1 px-2">
        {columns ? <Skeleton className="mx-2 h-4 w-24" /> : null}
        <RowsSkeleton rows={rows} height={height} />
      </CardContent>
      {footer ? (
        <CardFooter>
          <Skeleton className="h-4 w-48" />
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function FeedRowsSkeleton() {
  return <RowsSkeleton rows={4} height="h-9" />;
}

export function FeedCardSkeleton() {
  return <PanelSkeleton rows={4} height="h-9" footer={false} />;
}

export function PortfolioMoversCardSkeleton() {
  return <PanelSkeleton rows={5} height="h-10 sm:h-9" columns />;
}

export function DoNextCardSkeleton() {
  return <PanelSkeleton rows={5} height="h-16" />;
}

export function DashboardLedeSkeleton() {
  return (
    <div aria-hidden className={LEDE}>
      <Skeleton
        shape="text"
        className="inline-block w-80 max-w-full align-middle"
      />
    </div>
  );
}
