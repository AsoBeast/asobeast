import { Skeleton } from "@/components/ui/skeleton";

export function AnnotationsSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="size-8" />
        </div>
      ))}
    </div>
  );
}
