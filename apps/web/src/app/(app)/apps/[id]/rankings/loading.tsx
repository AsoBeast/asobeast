import { AnnotationsSkeleton } from "@/components/annotations/skeletons";
import { RankingChartSkeleton } from "@/components/rankings/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-full grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
      <div className="lg:col-span-2">
        <RankingChartSkeleton />
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AnnotationsSkeleton />
            <div className="flex flex-col gap-3" aria-hidden>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <Skeleton className="h-8 w-40" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
