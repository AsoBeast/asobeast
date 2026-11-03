import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-checkout flex flex-col gap-8 pb-40 sm:pb-28">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Skeleton className="h-5 w-56 rounded-full" />
          <Skeleton className="h-5 w-56 rounded-full" />
          <Skeleton className="h-5 w-56 rounded-full" />
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] xl:gap-12">
        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
          <Skeleton className="h-64" />
        </div>
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-4 shadow-raised sm:p-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[28rem] w-full rounded-xl" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
