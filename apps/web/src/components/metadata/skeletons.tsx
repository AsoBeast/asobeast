import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontLocalizationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function DraftLocalizationSkeleton() {
  return <Skeleton className="h-14 w-72 max-w-full" />;
}
