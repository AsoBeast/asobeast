import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-8 pb-40 sm:pb-24">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,36rem)]">
        <div className="flex flex-col gap-6 lg:order-last">
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-40" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-[28rem] w-full" />
        </div>
      </div>
    </div>
  );
}
