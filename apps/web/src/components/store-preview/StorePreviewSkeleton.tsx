import { Skeleton } from "@/components/ui/skeleton";

export function StorePreviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the store preview"
      className="flex flex-col gap-3"
    >
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
