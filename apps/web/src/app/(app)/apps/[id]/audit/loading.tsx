import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-8">
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex items-center gap-4 xl:col-span-5">
          <Skeleton className="size-[132px] rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full max-w-48" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:col-span-7">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
