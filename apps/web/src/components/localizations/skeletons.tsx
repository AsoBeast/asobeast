import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 3;

export function AppLocalizationsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-[47px] items-center border-b border-border px-4">
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-28 w-full" />
        {Array.from({ length: ROWS }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
