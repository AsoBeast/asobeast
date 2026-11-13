import { AnnotationsSkeleton } from "@/components/annotations/skeletons";
import { SerpMoversSkeleton } from "@/components/rankings/SerpMoversCard";
import {
  PanelHeaderSkeleton,
  RankingChartSkeleton,
  RankingsHeaderSkeleton,
} from "@/components/rankings/skeletons";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="@container/rankings page-full flex flex-col gap-6">
      <RankingsHeaderSkeleton />
      <div className="grid gap-6 @5xl/rankings:grid-cols-12 [&>*]:min-w-0">
        <div className="@5xl/rankings:col-span-8">
          <RankingChartSkeleton />
        </div>
        <div className="flex flex-col gap-6 @5xl/rankings:col-span-4">
          <Card>
            <PanelHeaderSkeleton action="w-32" />
            <CardContent className="px-2">
              <SerpMoversSkeleton />
            </CardContent>
          </Card>
          <Card>
            <PanelHeaderSkeleton action="w-32" />
            <CardContent className="px-2">
              <AnnotationsSkeleton />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
