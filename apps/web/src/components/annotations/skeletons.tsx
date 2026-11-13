import { Skeleton } from "@/components/ui/skeleton";

export function AnnotationsSkeleton() {
  return (
    <div className="flex flex-col px-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex h-10 items-center gap-3 sm:h-9">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="size-7" />
        </div>
      ))}
    </div>
  );
}
