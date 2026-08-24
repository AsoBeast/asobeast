import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <Skeleton className="h-[336px] w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <Skeleton className="h-28 w-40 rounded-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
