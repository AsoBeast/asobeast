import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  AUDIT_GRID,
  AUDIT_MAIN,
  AUDIT_PAIR,
  AUDIT_RAIL,
} from "@/components/audit/layout-classes";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RAIL_PANELS = ["h-52", "h-64"];

export default function Loading() {
  return (
    <div className="page-wide @container/audit flex flex-col gap-6">
      <Skeleton shape="text" className="w-full max-w-md" />
      <div className={AUDIT_GRID}>
        <div className={AUDIT_MAIN}>
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-4 p-4">
              <Skeleton
                data-slot="score-ring-skeleton"
                className="size-[132px] shrink-0 rounded-full"
              />
              <div className="flex flex-1 flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full max-w-48" />
                ))}
              </div>
            </div>
            <CardContent className="border-t border-border pt-3 pb-4">
              <ChartSkeleton height={CHART_HEIGHT.tall} />
            </CardContent>
          </Card>
        </div>
        <div className={AUDIT_RAIL}>
          {RAIL_PANELS.map((height) => (
            <Skeleton key={height} className={`${height} w-full rounded-lg`} />
          ))}
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className={AUDIT_PAIR}>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
