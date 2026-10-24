import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StoreConnectionsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-8 w-44" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full max-w-md" />
      </CardContent>
    </Card>
  );
}

export function PlaySignInReturnSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </CardHeader>
      <CardContent>
        <Skeleton className="size-6 rounded-full" />
      </CardContent>
    </Card>
  );
}
