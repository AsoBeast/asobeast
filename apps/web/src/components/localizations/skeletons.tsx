import { Skeleton } from "@/components/ui/skeleton";

export function AppLocalizationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
