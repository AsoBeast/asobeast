import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SetupLoading() {
  return (
    <div className="page-reading flex flex-col gap-4">
      {Array.from({ length: 5 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {index === 3 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }, (_, metric) => (
                    <div key={metric} className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-10" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </>
            ) : (
              <Skeleton className="h-4 w-36" />
            )}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-32" />
            </div>
            <Skeleton className="h-4 w-56" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
