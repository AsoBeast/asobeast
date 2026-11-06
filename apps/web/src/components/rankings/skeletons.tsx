import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RankingChartSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-56" />
        <CardAction>
          <Skeleton className="h-9 w-48" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className={cn(CHART_HEIGHT.hero, "w-full")} />
      </CardContent>
    </Card>
  );
}
