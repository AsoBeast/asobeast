import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SetupChecklistSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-full max-w-md" />
        <Skeleton className="h-1 w-full rounded-full" />
        <Skeleton className="h-5 w-full max-w-sm" />
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
