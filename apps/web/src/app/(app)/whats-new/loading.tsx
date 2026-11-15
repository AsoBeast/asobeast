import { Skeleton } from "@/components/ui/skeleton";

const FOLDED = ["first", "second", "third", "fourth", "fifth"] as const;

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="flex flex-col border-t">
        <div className="grid gap-3 border-b py-6 sm:grid-cols-[8rem_1fr] sm:gap-0">
          <div className="flex gap-3 pl-2 sm:flex-col">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-14" />
            {FOLDED.map((row) => (
              <Skeleton key={row} className="h-5 w-full" />
            ))}
          </div>
        </div>
        {FOLDED.map((row) => (
          <div
            key={row}
            className="flex min-h-10 items-center gap-3 border-b px-2"
          >
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
