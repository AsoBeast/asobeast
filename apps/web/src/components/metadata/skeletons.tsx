import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontLocalizationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
