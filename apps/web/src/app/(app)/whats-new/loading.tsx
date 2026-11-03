import { Skeleton } from "@/components/ui/skeleton";

const ENTRIES = ["first", "second"] as const;

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="flex flex-col">
        {ENTRIES.map((entry) => (
          <div
            key={entry}
            className="grid gap-3 pb-8 sm:grid-cols-[8rem_1fr] sm:gap-8"
          >
            <div className="flex gap-3 sm:flex-col">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex flex-col gap-3 sm:pl-8">
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
