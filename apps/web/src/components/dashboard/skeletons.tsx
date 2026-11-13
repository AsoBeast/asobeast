import type { AppView } from "@/lib/search-params";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricStripSkeleton } from "@/components/ui/stat-tile";
import {
  APPS_PANEL,
  APPS_SECTION,
  APP_GRID,
  PANEL_FOOTER,
} from "./layout-classes";
import { LEDE, PANEL_HEADER } from "@/components/layout/panel-classes";

export function MetricPanelSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-5 items-center justify-between gap-4">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <ChartSkeleton height={CHART_HEIGHT.tall} />
    </div>
  );
}

export function PortfolioPulseSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <MetricStripSkeleton columns={4} framed={false} />
      <div className="border-t border-border px-4 pt-3 pb-4">
        <MetricPanelSkeleton />
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

function AppCardSkeleton() {
  return (
    <Card className="h-full gap-0 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[22px] w-24 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="my-2 h-1.5 w-full rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
    </Card>
  );
}

export function AppsDashboardSkeleton({ view = "table" }: { view?: AppView }) {
  const tabular = view === "table";
  const frame = tabular ? APPS_PANEL : APPS_SECTION;
  return (
    <div className={frame.section}>
      <div className={frame.header}>
        <h2 className="text-heading">Apps</h2>
        <Skeleton className="h-8 w-44" />
      </div>
      {tabular ? (
        <>
          <div className="flex flex-col">
            <div className="flex h-9 items-center px-4">
              <Skeleton className="h-4 w-24" />
            </div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex h-[47px] items-center gap-3 border-t border-border-subtle px-4"
              >
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className={PANEL_FOOTER}>
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </>
      ) : (
        <ul className={APP_GRID}>
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index}>
              <AppCardSkeleton />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
