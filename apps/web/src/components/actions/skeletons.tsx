import type { ReactNode } from "react";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricStripSkeleton } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

export const ACTIONS_GRID =
  "grid gap-6 @5xl/actions:grid-cols-12 [&>*]:min-w-0";

export const QUEUE_COLUMN =
  "@container/queue flex flex-col gap-6 @5xl/actions:col-span-8";

export const QUEUE_SECTION = "flex flex-col gap-3";

export const RAIL_COLUMN =
  "flex flex-col gap-6 @5xl/actions:sticky @5xl/actions:top-20 @5xl/actions:col-span-4 @5xl/actions:self-start";

export function TextLineSkeleton({ width }: { width: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-[1em] max-w-full animate-pulse rounded-sm bg-muted align-middle motion-reduce:animate-none",
        width,
      )}
    />
  );
}

export function ActionHeaderSkeleton({ titled }: { titled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {titled ? <Skeleton className="h-[1.8rem] w-48" /> : null}
      <p className="text-body">
        <TextLineSkeleton width="w-80" />
      </p>
      <p className="text-label">
        <TextLineSkeleton width="w-56" />
      </p>
    </div>
  );
}

export function ActionOverviewSkeleton() {
  return <MetricStripSkeleton columns={4} />;
}

function PanelSkeleton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton shape="text" className={cn("text-heading", title)} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ActionListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton shape="text" className="w-3/5 text-body" />
          <Skeleton shape="text" className="w-4/5 text-caption" />
        </div>
      ))}
    </div>
  );
}

export function ActionToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-7 w-80 max-w-full" />
    </div>
  );
}

export function ActionRailSkeleton() {
  return (
    <div className={RAIL_COLUMN}>
      <PanelSkeleton title="w-20">
        <ChartSkeleton height={CHART_HEIGHT.tall} />
      </PanelSkeleton>
      <PanelSkeleton title="w-36">
        <ActionListSkeleton rows={2} />
      </PanelSkeleton>
    </div>
  );
}

export function ActionCenterSkeleton({ titled = true }: { titled?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <ActionHeaderSkeleton titled={titled} />
      <ActionOverviewSkeleton />
      <div className={ACTIONS_GRID}>
        <div className={QUEUE_COLUMN}>
          <PanelSkeleton title="w-24">
            <ActionListSkeleton rows={2} />
          </PanelSkeleton>
          <div className={QUEUE_SECTION}>
            <ActionToolbarSkeleton />
            <PanelSkeleton title="w-16">
              <ActionListSkeleton />
            </PanelSkeleton>
          </div>
        </div>
        <ActionRailSkeleton />
      </div>
    </div>
  );
}
