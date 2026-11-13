import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RankingsHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-5 w-full max-w-xl" />
    </div>
  );
}

export function PanelHeaderSkeleton({ action }: { action: string }) {
  return (
    <CardHeader className={PANEL_HEADER}>
      <Skeleton className="h-5 w-36" />
      <CardAction>
        <Skeleton className={cn("h-9", action)} />
      </CardAction>
    </CardHeader>
  );
}

export function RankingsPanelSkeleton() {
  return (
    <>
      <CardContent>
        <Skeleton className={cn(CHART_HEIGHT.hero, "w-full")} />
      </CardContent>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </CardContent>
      <CardFooter className="justify-between">
        <Skeleton className="h-4 w-56 max-w-[40vw]" />
        <Skeleton className="h-7 w-28" />
      </CardFooter>
    </>
  );
}

export function RankingChartSkeleton() {
  return (
    <Card>
      <PanelHeaderSkeleton action="w-64 max-w-[50vw]" />
      <RankingsPanelSkeleton />
    </Card>
  );
}
