import { RankingChartSkeleton } from "@/components/rankings/skeletons";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-full grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
      <div className="lg:col-span-2">
        <RankingChartSkeleton />
      </div>
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-40" />
        </CardHeader>
      </Card>
    </div>
  );
}
