import {
  ComparisonMatrixSkeleton,
  CompetitorListSkeleton,
} from "@/components/competitors/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-full flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <CompetitorListSkeleton />
      <ComparisonMatrixSkeleton />
    </div>
  );
}
