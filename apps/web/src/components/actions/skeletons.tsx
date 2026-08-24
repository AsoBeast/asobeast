import { Skeleton } from "@/components/ui/skeleton";

export function ActionFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-full max-w-md rounded-md" />
      <Skeleton className="h-8 w-full max-w-sm rounded-md" />
      <Skeleton className="h-8 w-full max-w-2xl rounded-md" />
    </div>
  );
}

export function ActionListSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} className="h-[248px] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ActionCenterSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ActionFiltersSkeleton />
      <ActionListSkeleton />
    </div>
  );
}

export function ActionsSummaryCardSkeleton() {
  return <Skeleton className="h-[196px] w-full rounded-xl" />;
}
