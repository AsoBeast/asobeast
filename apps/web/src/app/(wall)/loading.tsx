import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Card className="mx-auto my-auto w-full max-w-sm">
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}
